import express from 'express'
import { authenticate, AuthRequest } from '../middleware/auth'
import prisma from '../utils/prisma'
import { applyClockInRounding, applyClockOutRounding } from '../utils/timeRounding'

const router = express.Router()

interface ImportEntry {
  date: string
  clockIn?: string
  clockOut?: string
  hours?: number
  minutes?: number
  duration?: string // "8:30" format
  notes?: string
  description?: string
  breakMinutes?: number // Break time in minutes
}

/**
 * Parse break time string like "0h 15m" or "4h 00m" to minutes
 */
function parseBreakTime(breakTimeStr: string): number {
  const match = breakTimeStr.match(/(\d+)h\s*(\d+)m/)
  if (match) {
    const hours = parseInt(match[1]) || 0
    const minutes = parseInt(match[2]) || 0
    return hours * 60 + minutes
  }
  return 0
}

/**
 * Parse Hours Keeper CSV format
 * Format can be:
 * 1) First line is date range, second line is headers, data starts at line 3
 * 2) First line is headers, data starts at line 2
 * Headers: "Client Name","Start Time","End Time","Break Time","Worked Hours","Rate/h","Amount","Note"
 */
function parseHoursKeeperCSV(csvContent: string): ImportEntry[] {
  const lines = csvContent.split('\n').filter(line => line.trim())
  console.log(`Total lines in CSV: ${lines.length}`)
  
  if (lines.length < 2) {
    console.log('Not enough lines in CSV (need at least 2)')
    return [] // Need at least headers and one data row
  }

  // Detect if first line is headers or date range
  // Headers line will contain "Start Time" or "Client Name"
  const firstLine = lines[0].toLowerCase()
  const isFirstLineHeaders = firstLine.includes('start time') || firstLine.includes('client name') || firstLine.includes('end time')
  
  // Determine header line index and data start index
  const headerLineIndex = isFirstLineHeaders ? 0 : 1
  const dataStartIndex = isFirstLineHeaders ? 1 : 2
  
  console.log(`First line is headers: ${isFirstLineHeaders}`)
  console.log(`Header line index: ${headerLineIndex}, Data start index: ${dataStartIndex}`)
  
  if (lines.length <= dataStartIndex) {
    console.log('Not enough data rows after headers')
    return []
  }

  const headerLine = lines[headerLineIndex]
  console.log('Header line:', headerLine)
  
  // Parse headers properly (handle quoted values)
  const headerValues: string[] = []
  let currentHeader = ''
  let inQuotes = false
  
  for (let j = 0; j < headerLine.length; j++) {
    const char = headerLine[j]
    if (char === '"') {
      inQuotes = !inQuotes
    } else if (char === ',' && !inQuotes) {
      headerValues.push(currentHeader.trim().replace(/^"|"$/g, '').toLowerCase())
      currentHeader = ''
    } else {
      currentHeader += char
    }
  }
  headerValues.push(currentHeader.trim().replace(/^"|"$/g, '').toLowerCase())
  
  const headers = headerValues
  const entries: ImportEntry[] = []
  
  console.log('Parsed headers:', headers)

  // Parse data rows starting from dataStartIndex
  console.log(`Parsing ${lines.length - dataStartIndex} data rows`)
  for (let i = dataStartIndex; i < lines.length; i++) {
    if (i === dataStartIndex) {
      console.log('First data row:', lines[i])
    }
    // Parse CSV line respecting quotes - better parser for quoted fields
    const values: string[] = []
    let currentValue = ''
    let inQuotes = false
    
    for (let j = 0; j < lines[i].length; j++) {
      const char = lines[i][j]
      const nextChar = j < lines[i].length - 1 ? lines[i][j + 1] : ''
      
      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          // Escaped quote
          currentValue += '"'
          j++ // Skip next quote
        } else {
          // Toggle quote state
          inQuotes = !inQuotes
        }
      } else if (char === ',' && !inQuotes) {
        values.push(currentValue.trim())
        currentValue = ''
      } else {
        currentValue += char
      }
    }
    values.push(currentValue.trim()) // Add last value
    
    // Remove quotes from values
    const cleanedValues = values.map(v => v.replace(/^"|"$/g, ''))
    
    const entry: Partial<ImportEntry> = {}
    let breakMinutes = 0

    headers.forEach((header, index) => {
      const value = cleanedValues[index] || ''
      
      if (header === 'start time' || header.includes('start time')) {
        entry.clockIn = value
        if (i === dataStartIndex) console.log('Found clockIn:', value)
      } else if (header === 'end time' || header.includes('end time')) {
        entry.clockOut = value
        if (i === dataStartIndex) console.log('Found clockOut:', value)
      } else if (header === 'break time' || header.includes('break time')) {
        breakMinutes = parseBreakTime(value)
        if (i === dataStartIndex) console.log('Found break time:', value, 'parsed to', breakMinutes, 'minutes')
      } else if (header === 'note' || header.includes('note')) {
        entry.notes = value
        entry.description = value
      }
    })
    
    if (i === dataStartIndex) {
      console.log('Entry after header matching:', {
        clockIn: entry.clockIn,
        clockOut: entry.clockOut,
        breakMinutes,
        cleanedValues,
        headers
      })
    }

    // Extract date from start time if available
    if (entry.clockIn) {
      // Format: "December 10, 2025 at 11:10:00 AM"
      const dateMatch = entry.clockIn.match(/(\w+\s+\d+,\s+\d+)/)
      if (dateMatch) {
        entry.date = dateMatch[1]
      }
    }

    if (entry.clockIn && entry.clockOut && entry.clockIn.trim() && entry.clockOut.trim()) {
      const importEntry: ImportEntry & { breakMinutes?: number } = {
        date: entry.date || '',
        clockIn: entry.clockIn,
        clockOut: entry.clockOut,
        notes: entry.notes || entry.description || '',
        breakMinutes
      }
      entries.push(importEntry)
    } else {
      console.log(`Skipping row ${i}: missing clockIn or clockOut`, {
        clockIn: entry.clockIn,
        clockOut: entry.clockOut,
        cleanedValues
      })
    }
  }

  console.log(`Total entries parsed: ${entries.length}`)
  return entries as any
}

/**
 * Parse Hours Keeper datetime string like "December 10, 2025 at 11:10:00 AM"
 */
function parseHoursKeeperDateTime(dateTimeStr: string): Date | null {
  try {
    if (!dateTimeStr || !dateTimeStr.trim()) {
      return null
    }
    
    // Format: "December 10, 2025 at 11:10:00 AM"
    // Try manual parsing first (more reliable)
    const match = dateTimeStr.match(/(\w+)\s+(\d+),\s+(\d+)\s+at\s+(\d+):(\d+):(\d+)\s+(AM|PM)/i)
    if (match) {
      const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December']
      const monthName = match[1]
      const month = monthNames.indexOf(monthName)
      const day = parseInt(match[2])
      const year = parseInt(match[3])
      let hour = parseInt(match[4])
      const minute = parseInt(match[5])
      const second = parseInt(match[6])
      const ampm = match[7].toUpperCase()
      
      if (month === -1) {
        console.error('Invalid month:', monthName)
        return null
      }
      
      // Convert to 24-hour format
      if (ampm === 'PM' && hour !== 12) {
        hour += 12
      } else if (ampm === 'AM' && hour === 12) {
        hour = 0
      }
      
      const date = new Date(year, month, day, hour, minute, second)
      if (isNaN(date.getTime())) {
        console.error('Invalid date created:', year, month, day, hour, minute, second)
        return null
      }
      
      return date
    }
    
    // Fallback: try parsing with Date constructor
    const normalized = dateTimeStr.replace(' at ', ', ')
    const date = new Date(normalized)
    
    if (!isNaN(date.getTime())) {
      return date
    }
    
    console.error('Could not parse datetime:', dateTimeStr)
    return null
  } catch (error) {
    console.error('Error parsing datetime:', dateTimeStr, error)
    return null
  }
}

/**
 * Convert import entry to database entry
 */
async function convertToTimeEntry(
  importEntry: ImportEntry & { breakMinutes?: number },
  userId: string,
  roundingInterval: number = 5
): Promise<{ clockIn: Date; clockOut: Date; totalBreakMinutes: number; notes: string | null } | null> {
  try {
    let clockIn: Date | null = null
    let clockOut: Date | null = null

    // Method 1: Hours Keeper format with full datetime strings
    if (importEntry.clockIn && importEntry.clockOut) {
      clockIn = parseHoursKeeperDateTime(importEntry.clockIn)
      clockOut = parseHoursKeeperDateTime(importEntry.clockOut)
    }
    // Method 2: Direct clock in/out times (HH:MM format)
    else if (importEntry.clockIn && importEntry.clockOut && !importEntry.clockIn.includes('at')) {
      // Try to parse as simple time format
      const date = importEntry.date ? new Date(importEntry.date) : new Date()
      if (isNaN(date.getTime())) {
        // Try different date formats
        const dateParts = importEntry.date.split(/[-\/]/)
        if (dateParts.length === 3) {
          date.setFullYear(parseInt(dateParts[2]))
          date.setMonth(parseInt(dateParts[0]) - 1)
          date.setDate(parseInt(dateParts[1]))
        }
      }
      
      const timeIn = importEntry.clockIn.split(':')
      const timeOut = importEntry.clockOut.split(':')
      
      if (timeIn.length >= 2 && timeOut.length >= 2) {
        clockIn = new Date(date)
        clockIn.setHours(parseInt(timeIn[0]), parseInt(timeIn[1]), 0, 0)
        
        clockOut = new Date(date)
        clockOut.setHours(parseInt(timeOut[0]), parseInt(timeOut[1]), 0, 0)
        
        // If clock out is before clock in, assume next day
        if (clockOut <= clockIn) {
          clockOut.setDate(clockOut.getDate() + 1)
        }
      }
    }
    // Method 3: Duration string (e.g., "8:30")
    else if (importEntry.duration) {
      const date = importEntry.date ? new Date(importEntry.date) : new Date()
      const durationParts = importEntry.duration.split(':')
      if (durationParts.length >= 2) {
        const hours = parseInt(durationParts[0]) || 0
        const minutes = parseInt(durationParts[1]) || 0
        
        // Assume 9 AM start (common default)
        clockIn = new Date(date)
        clockIn.setHours(9, 0, 0, 0)
        
        clockOut = new Date(date)
        clockOut.setHours(9 + hours, minutes, 0, 0)
      }
    }
    // Method 4: Hours and minutes separately
    else if (importEntry.hours !== undefined || importEntry.minutes !== undefined) {
      const date = importEntry.date ? new Date(importEntry.date) : new Date()
      const totalHours = (importEntry.hours || 0) + (importEntry.minutes || 0) / 60
      
      // Assume 9 AM start
      clockIn = new Date(date)
      clockIn.setHours(9, 0, 0, 0)
      
      clockOut = new Date(date)
      clockOut.setHours(9 + Math.floor(totalHours), (totalHours % 1) * 60, 0, 0)
    }

    if (!clockIn || !clockOut) {
      return null
    }

    // Apply time rounding (round DOWN for clock-in, UP for clock-out)
    clockIn = applyClockInRounding(clockIn, roundingInterval)
    clockOut = applyClockOutRounding(clockOut, roundingInterval)

    // Ensure clock out is after clock in
    if (clockOut <= clockIn) {
      return null
    }

    // Get break minutes (default to 0 if not provided)
    const totalBreakMinutes = importEntry.breakMinutes || 0

    return {
      clockIn,
      clockOut,
      totalBreakMinutes,
      notes: importEntry.notes || importEntry.description || null
    }
  } catch (error) {
    console.error('Error converting entry:', error)
    return null
  }
}

// Import time entries from Hours Keeper
router.post('/', authenticate, async (req: AuthRequest, res) => {
  try {
    console.log('Import request received, body keys:', Object.keys(req.body))
    const { csvContent, startDate, endDate } = req.body

    if (!csvContent || typeof csvContent !== 'string') {
      console.error('Missing or invalid csvContent:', typeof csvContent, csvContent ? 'present' : 'missing')
      return res.status(400).json({ error: 'CSV content is required' })
    }

    // Get user settings
    const user = await prisma.user.findUnique({
      where: { id: req.userId! },
      select: { timeRoundingInterval: true }
    })

    if (!user) {
      return res.status(404).json({ error: 'User not found' })
    }

    const roundingInterval = user?.timeRoundingInterval || 5

    // Parse CSV
    console.log('Starting CSV parse, content length:', csvContent.length)
    console.log('First 200 chars of CSV:', csvContent.substring(0, 200))
    
    const importEntries = parseHoursKeeperCSV(csvContent)
    
    console.log(`Parsed ${importEntries.length} entries from CSV`)

    if (importEntries.length === 0) {
      console.error('No entries parsed. CSV preview:', csvContent.substring(0, 500))
      return res.status(400).json({ 
        error: 'No valid entries found in CSV. Please check the file format. Expected format: First line is date range, second line has headers "Client Name","Start Time","End Time", etc.' 
      })
    }

    // Convert to time entries
    const timeEntries: Array<{ clockIn: Date; clockOut: Date; totalBreakMinutes: number; notes: string | null }> = []
    
    for (const importEntry of importEntries) {
      const entry = await convertToTimeEntry(importEntry, req.userId!, roundingInterval)
      if (entry) {
        // Filter by date range if provided
        if (startDate) {
          const start = new Date(startDate)
          start.setHours(0, 0, 0, 0)
          if (entry.clockIn < start) continue
        }
        if (endDate) {
          const end = new Date(endDate)
          end.setHours(23, 59, 59, 999)
          if (entry.clockIn > end) continue
        }
        
        timeEntries.push(entry)
      }
    }

    if (timeEntries.length === 0) {
      return res.status(400).json({ error: 'No valid time entries could be created' })
    }

    // Import entries (skip duplicates based on clock in time within same day)
    let imported = 0
    let skipped = 0

    for (const entry of timeEntries) {
      const dayStart = new Date(entry.clockIn)
      dayStart.setHours(0, 0, 0, 0)
      const dayEnd = new Date(entry.clockIn)
      dayEnd.setHours(23, 59, 59, 999)

      // Check if entry already exists for this day
      const existing = await prisma.timeEntry.findFirst({
        where: {
          userId: req.userId!,
          clockIn: {
            gte: dayStart,
            lte: dayEnd
          }
        }
      })

      if (!existing) {
        await prisma.timeEntry.create({
          data: {
            userId: req.userId!,
            clockIn: entry.clockIn,
            clockOut: entry.clockOut,
            totalBreakMinutes: entry.totalBreakMinutes,
            notes: entry.notes,
            isManualEntry: true
          }
        })
        imported++
      } else {
        skipped++
      }
    }

    res.json({
      success: true,
      imported,
      skipped,
      total: timeEntries.length
    })
  } catch (error) {
    console.error('Import error:', error)
    res.status(500).json({ error: 'Failed to import data' })
  }
})

export default router

