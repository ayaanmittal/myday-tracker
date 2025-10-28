import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

export interface TaskData {
  id: string;
  title: string;
  description: string;
  status: string;
  priority: string;
  created_at: string;
  due_date: string | null;
}

export interface LeaveData {
  id: string;
  leave_date: string;
  is_paid_leave: boolean;
  is_approved: boolean;
  leave_types?: {
    name: string;
  };
}

export interface DayUpdate {
  id: string;
  today_focus: string;
  progress: string;
  blockers: string | null;
  created_at: string;
  entry_date: string;
}

export interface SalaryData {
  base_salary: number;
  total_deductions: number;
  net_salary: number;
  total_paid_leaves: number;
  total_unpaid_leaves: number;
}

export interface AttendanceEntry {
  entry_date: string;
  check_in_at: string | null;
  check_out_at: string | null;
  total_work_time_minutes: number | null;
  status: string;
  is_late: boolean;
  lunch_break_start?: string | null;
  lunch_break_end?: string | null;
}

export interface EmployeeInfo {
  name: string;
  email: string;
  designation: string | null;
  team: string | null;
}

export async function generateProgressReportPDF(
  employeeInfo: EmployeeInfo,
  attendanceData: AttendanceEntry[],
  tasks: TaskData[],
  leaves: LeaveData[],
  dayUpdates: DayUpdate[],
  salaryData: SalaryData | null,
  startDate: string,
  endDate: string,
  logoUrl?: string
) {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();

  doc.setFont('helvetica');

  // Load logo if not provided
  let finalLogoUrl = logoUrl;
  if (!finalLogoUrl) {
    try {
      finalLogoUrl = await loadLogoForPdf();
    } catch (error) {
      console.warn('Could not load logo:', error);
    }
  }

  // Add logo if available
  if (finalLogoUrl) {
    try {
      doc.addImage(finalLogoUrl, 'PNG', pageWidth - 45, 10, 30, 15);
    } catch (error) {
      console.warn('Could not add logo:', error);
    }
  }

  let currentY = 25;

  // Header
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text('Employee Progress Report', 14, currentY);
  currentY += 10;

  // Employee Information
  doc.setFontSize(12);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(0, 0, 0);
  doc.text(`Employee: ${employeeInfo.name}`, 14, currentY);
  currentY += 6;
  doc.text(`Email: ${employeeInfo.email}`, 14, currentY);
  currentY += 6;
  if (employeeInfo.designation) {
    doc.text(`Designation: ${employeeInfo.designation}`, 14, currentY);
    currentY += 6;
  }
  if (employeeInfo.team) {
    doc.text(`Team: ${employeeInfo.team}`, 14, currentY);
    currentY += 6;
  }
  doc.text(`Period: ${formatDate(startDate)} - ${formatDate(endDate)}`, 14, currentY);
  currentY += 6;
  doc.text(`Generated: ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`, 14, currentY);
  currentY += 15;

  // Summary Box - Professional formatting
  const totalDays = attendanceData.length;
  const completedDays = attendanceData.filter(e => e.status === 'completed').length;
  const avgWorkMinutes = attendanceData.reduce((sum, e) => sum + (e.total_work_time_minutes || 0), 0) / completedDays || 0;
  const lateDays = attendanceData.filter(e => e.is_late).length;
  const tasksCompleted = tasks.filter(t => t.status === 'completed').length;
  const leavesCount = leaves.length;
  
  // Draw summary box
  doc.setFillColor(250, 250, 250);
  doc.setDrawColor(200, 200, 200);
  doc.setLineWidth(0.5);
  doc.roundedRect(14, currentY, 180, 32, 4, 4, 'FD');
  
  // Summary title
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(40, 40, 40);
  doc.text('Summary', 18, currentY + 7);
  
  // Set font sizes and colors for consistency
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80); // Label color
  
  // Row 1: Work statistics (properly aligned)
  const labelX = 18;
  const valueX = 68;
  
  doc.text('Work Days:', labelX, currentY + 16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(totalDays.toString().padStart(3, '0'), valueX, currentY + 16);
  
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  doc.text('Completed:', 88, currentY + 16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(completedDays.toString().padStart(3, '0'), 128, currentY + 16);
  
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  doc.text('Avg Work:', 148, currentY + 16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(formatTime(avgWorkMinutes), 170, currentY + 16);
  
  // Row 2: Additional statistics
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  doc.text('Late Days:', labelX, currentY + 24);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(229, 57, 53); // ERCMAX red
  doc.text(lateDays.toString(), valueX, currentY + 24);
  
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  doc.text('Tasks Done:', 88, currentY + 24);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  const taskText = tasks.length > 0 ? `${tasksCompleted}/${tasks.length}` : '0/0';
  doc.text(taskText, 128, currentY + 24);
  
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(80, 80, 80);
  doc.text('Leaves:', 148, currentY + 24);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(0, 0, 0);
  doc.text(leavesCount.toString(), 165, currentY + 24);
  
  // Reset text color
  doc.setTextColor(0, 0, 0);
  
  currentY += 40;

  // Attendance Summary Table with professional formatting
  autoTable(doc, {
    startY: currentY,
    head: [['Date', 'Check-in', 'Check-out', 'Work Time', 'Lunch', 'Status']],
    body: attendanceData.map(entry => {
      const checkIn = entry.check_in_at ? formatTimeOnly(entry.check_in_at) : 'N/A';
      const checkOut = entry.check_out_at ? formatTimeOnly(entry.check_out_at) : 'N/A';
      const workTime = entry.total_work_time_minutes ? formatTime(entry.total_work_time_minutes) : 'N/A';
      const lunchDuration = entry.lunch_break_start && entry.lunch_break_end 
        ? formatTime(calculateMinutes(entry.lunch_break_start, entry.lunch_break_end))
        : 'N/A';
      const status = entry.status.charAt(0).toUpperCase() + entry.status.slice(1);
      const lateMarker = entry.is_late ? ' ⚠' : '';
      
      return [
        formatDate(entry.entry_date),
        checkIn,
        checkOut,
        workTime,
        lunchDuration,
        status + lateMarker
      ];
    }),
    theme: 'striped',
    styles: {
      fontSize: 8,
      cellPadding: 2.5,
      font: 'helvetica',
      textColor: [0, 0, 0],
      halign: 'center'
    },
    headStyles: {
      fillColor: [59, 130, 246],
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 8,
      halign: 'center'
    },
    bodyStyles: {
      font: 'helvetica',
      halign: 'center',
      textColor: [60, 60, 60]
    },
    alternateRowStyles: {
      fillColor: [250, 250, 250],
      textColor: [60, 60, 60]
    },
    margin: { top: currentY, left: 14, right: 14 }
  });

  currentY = (doc as any).lastAutoTable.finalY + 15;

  // Tasks Section (if tasks exist) with professional formatting
  if (tasks.length > 0) {
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(40, 40, 40);
    doc.text('Tasks Assigned', 14, currentY);
    currentY += 8;
    
    autoTable(doc, {
      startY: currentY,
      head: [['Title', 'Priority', 'Status', 'Created', 'Due Date']],
      body: tasks.map(task => [
        truncateText(task.title, 35),
        task.priority ? task.priority.charAt(0).toUpperCase() + task.priority.slice(1) : 'Medium',
        task.status.charAt(0).toUpperCase() + task.status.slice(1),
        formatDate(task.created_at),
        task.due_date ? formatDate(task.due_date) : 'N/A'
      ]),
      theme: 'striped',
      styles: {
        fontSize: 8,
        cellPadding: 2.5,
        font: 'helvetica',
        textColor: [0, 0, 0],
        halign: 'left'
      },
      headStyles: {
        fillColor: [34, 197, 94],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
        halign: 'center'
      },
      bodyStyles: {
        font: 'helvetica',
        halign: 'left',
        textColor: [60, 60, 60]
      },
      alternateRowStyles: {
        fillColor: [250, 250, 250],
        textColor: [60, 60, 60]
      },
      margin: { left: 14, right: 14 }
    });

    currentY = (doc as any).lastAutoTable.finalY + 15;
  }

  // Leaves Section with professional formatting
  if (leaves.length > 0) {
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(40, 40, 40);
    doc.text('Leave Records', 14, currentY);
    currentY += 8;
    
    autoTable(doc, {
      startY: currentY,
      head: [['Date', 'Type', 'Paid', 'Status']],
      body: leaves.map(leave => [
        formatDate(leave.leave_date),
        leave.leave_types?.name || 'N/A',
        leave.is_paid_leave ? 'Yes' : 'No',
        leave.is_approved ? 'Approved' : 'Pending'
      ]),
      theme: 'striped',
      styles: {
        fontSize: 8,
        cellPadding: 2.5,
        font: 'helvetica',
        textColor: [0, 0, 0],
        halign: 'center'
      },
      headStyles: {
        fillColor: [168, 85, 247],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
        halign: 'center'
      },
      bodyStyles: {
        font: 'helvetica',
        halign: 'center',
        textColor: [60, 60, 60]
      },
      alternateRowStyles: {
        fillColor: [250, 250, 250],
        textColor: [60, 60, 60]
      },
      margin: { left: 14, right: 14 }
    });

    currentY = (doc as any).lastAutoTable.finalY + 15;
  }

  // Day Updates Section with professional formatting
  if (dayUpdates.length > 0) {
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(40, 40, 40);
    doc.text('Daily Updates', 14, currentY);
    currentY += 10;

    dayUpdates.slice(0, 10).forEach((update, index) => {
      if (currentY > pageHeight - 60) {
        doc.addPage();
        currentY = 25;
      }
      
      // Date header
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(40, 40, 40);
      doc.text(`• ${formatDate(update.entry_date)}`, 18, currentY);
      currentY += 6;
      
      // Focus
      doc.setFontSize(8);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(60, 60, 60);
      doc.text(`Focus: ${truncateText(update.today_focus, 65)}`, 22, currentY);
      currentY += 5;
      
      if (update.progress) {
        doc.text(`Progress: ${truncateText(update.progress, 65)}`, 22, currentY);
        currentY += 5;
      }
      
      if (update.blockers) {
        doc.setTextColor(220, 38, 38);
        doc.text(`Blockers: ${truncateText(update.blockers, 65)}`, 22, currentY);
        doc.setTextColor(0, 0, 0);
        currentY += 5;
      }
      
      // Divider line
      doc.setDrawColor(220, 220, 220);
      doc.setLineWidth(0.3);
      doc.line(18, currentY, 190, currentY);
      currentY += 6;
    });
  }

  // Salary Section (if available) with professional formatting
  if (salaryData) {
    if (currentY > pageHeight - 80) {
      doc.addPage();
      currentY = 25;
    }
    
    // Draw salary box
    doc.setFillColor(250, 250, 250);
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.5);
    doc.roundedRect(14, currentY, 180, 35, 4, 4, 'FD');
    
    // Title
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(40, 40, 40);
    doc.text('Salary & Deductions', 18, currentY + 8);
    
    // Content with proper alignment
    const salaryY = currentY + 16;
    const labelX = 18;
    const valueX = 75;
    
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    
    doc.text('Base Salary:', labelX, salaryY);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(`₹${salaryData.base_salary.toLocaleString('en-IN')}`, valueX, salaryY);
    
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    doc.text('Deductions:', labelX, salaryY + 6);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(220, 38, 38);
    doc.text(`₹${salaryData.total_deductions.toLocaleString('en-IN')}`, valueX, salaryY + 6);
    
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    doc.text('Net Salary:', labelX, salaryY + 12);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(16, 185, 129);
    doc.text(`₹${salaryData.net_salary.toLocaleString('en-IN')}`, valueX, salaryY + 12);
    
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    doc.text('Paid Leaves:', 100, salaryY);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(0, 0, 0);
    doc.text(`${salaryData.total_paid_leaves}`, 135, salaryY);
    
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    doc.text('Unpaid Leaves:', 100, salaryY + 6);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(220, 38, 38);
    doc.text(`${salaryData.total_unpaid_leaves}`, 147, salaryY + 6);
  }

  // Footer on each page
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(100, 100, 100);
    doc.text(
      `Page ${i} of ${pageCount}`,
      pageWidth / 2,
      pageHeight - 10,
      { align: 'center' }
    );
    doc.text(
      employeeInfo.name,
      pageWidth - 14,
      pageHeight - 10,
      { align: 'right' }
    );
  }

  // Save the PDF
  const fileName = `${employeeInfo.name.replace(/\s+/g, '_')}_Progress_Report_${startDate}_to_${endDate}.pdf`;
  doc.save(fileName);
}

function formatDate(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTimeOnly(dateString: string): string {
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function formatTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = Math.floor(minutes % 60);
  return `${hours}h ${mins}m`;
}

function calculateMinutes(start: string, end: string): number {
  const startTime = new Date(start);
  const endTime = new Date(end);
  return Math.floor((endTime.getTime() - startTime.getTime()) / (1000 * 60));
}

function truncateText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength - 3) + '...';
}

// Helper function to load logo from public folder
async function loadLogoForPdf(): Promise<string | null> {
  try {
    // Load ercmax logo from public folder
    const logoPath = '/logo.png';
    
    const response = await fetch(logoPath);
    if (!response.ok) {
      console.warn('Logo not found at', logoPath);
      return null;
    }
    
    const blob = await response.blob();
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve(reader.result as string);
      };
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.warn('Error loading logo:', error);
    return null;
  }
}

