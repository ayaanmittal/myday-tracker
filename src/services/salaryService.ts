import { supabase } from '@/integrations/supabase/client';

export interface EmployeeSalary {
  id: string;
  user_id: string;
  profile_id: string;
  base_salary: number;
  currency: string;
  salary_frequency: string;
  effective_from: string;
  effective_to?: string;
  is_active: boolean;
  notes?: string;
  created_by?: string;
  created_at: string;
  updated_at: string;
}

export interface SalaryPayment {
  id: string;
  user_id: string;
  profile_id: string;
  payment_month: string;
  base_salary: number;
  gross_salary: number;
  deductions: number;
  net_salary: number;
  leave_deductions: number;
  unpaid_leave_days: number;
  deduction_percentage: number;
  is_paid: boolean;
  payment_date?: string;
  payment_method?: string;
  payment_reference?: string;
  notes?: string;
  processed_by?: string;
  created_at: string;
  updated_at: string;
}

export interface PayrollAnalytics {
  total_employees: number;
  total_payroll_outflow: number;
  average_salary: number;
  highest_paid_employee: string;
  highest_salary: number;
  total_leave_deductions: number;
  average_deduction_percentage: number;
}

export interface LeaveDeduction {
  id: string;
  salary_payment_id: string;
  user_id: string;
  leave_date: string;
  leave_type: string;
  is_paid_leave: boolean;
  deduction_amount: number;
  daily_salary_rate: number;
  created_at: string;
}

export class SalaryService {
  // Employee Salary Management
  static async getEmployeeSalaries(): Promise<EmployeeSalary[]> {
    const { data, error } = await supabase
      .from('employee_salaries')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data || [];
  }

  static async getEmployeeSalary(userId: string): Promise<EmployeeSalary | null> {
    const { data, error } = await supabase
      .from('employee_salaries')
      .select('*')
      .eq('user_id', userId)
      .eq('is_active', true)
      .order('effective_from', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  static async addEmployeeSalary(salary: Partial<EmployeeSalary>): Promise<EmployeeSalary> {
    const { data, error } = await supabase
      .from('employee_salaries')
      .insert(salary)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async updateEmployeeSalary(id: string, updates: Partial<EmployeeSalary>): Promise<EmployeeSalary> {
    const { data, error } = await supabase
      .from('employee_salaries')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  }

  static async deactivateEmployeeSalary(id: string): Promise<void> {
    const { error } = await supabase
      .from('employee_salaries')
      .update({ is_active: false, effective_to: new Date().toISOString().slice(0, 10) })
      .eq('id', id);

    if (error) throw error;
  }

  // Salary Payment Management
  static async getSalaryPayments(month?: string): Promise<SalaryPayment[]> {
    let query = supabase
      .from('salary_payments')
      .select(`
        *,
        profiles!inner(name, email, designation)
      `)
      .order('created_at', { ascending: false });

    if (month) {
      const monthStart = new Date(month + '-01');
      query = query.eq('payment_month', monthStart.toISOString().slice(0, 10));
    }

    const { data, error } = await query;

    if (error) throw error;
    return data || [];
  }

  static async getSalaryPayment(id: string): Promise<SalaryPayment | null> {
    const { data, error } = await supabase
      .from('salary_payments')
      .select(`
        *,
        profiles!inner(name, email, designation)
      `)
      .eq('id', id)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    return data;
  }

  static async generateMonthlyPayments(paymentMonth: string, selectedEmployees?: string[]): Promise<SalaryPayment[]> {
    const monthStart = new Date(paymentMonth + '-01');
    
    const { data, error } = await supabase
      .rpc('generate_monthly_salary_payments', {
        p_payment_month: monthStart.toISOString().slice(0, 10),
        p_processed_by: null,
        p_selected_employees: selectedEmployees || null
      });

    if (error) throw error;
    return data || [];
  }

  static async updatePaymentStatus(
    paymentId: string,
    isPaid: boolean,
    paymentMethod?: string,
    paymentReference?: string,
    notes?: string
  ): Promise<SalaryPayment> {
    const { data, error } = await supabase
      .rpc('update_salary_payment_status', {
        p_payment_id: paymentId,
        p_is_paid: isPaid,
        p_payment_date: isPaid ? new Date().toISOString().slice(0, 10) : null,
        p_payment_method: paymentMethod,
        p_payment_reference: paymentReference,
        p_notes: notes
      });

    if (error) throw error;
    return data;
  }

  // Analytics
  static async getPayrollAnalytics(
    startMonth?: string,
    endMonth?: string
  ): Promise<PayrollAnalytics> {
    const start = startMonth ? new Date(startMonth + '-01') : new Date(Date.now() - 12 * 30 * 24 * 60 * 60 * 1000);
    const end = endMonth ? new Date(endMonth + '-01') : new Date();

    const { data, error } = await supabase
      .rpc('get_payroll_analytics', {
        p_start_month: start.toISOString().slice(0, 10),
        p_end_month: end.toISOString().slice(0, 10)
      });

    if (error) throw error;
    return data?.[0] || {
      total_employees: 0,
      total_payroll_outflow: 0,
      average_salary: 0,
      highest_paid_employee: 'N/A',
      highest_salary: 0,
      total_leave_deductions: 0,
      average_deduction_percentage: 0
    };
  }

  // Leave Deductions
  static async getLeaveDeductions(paymentId: string): Promise<LeaveDeduction[]> {
    const { data, error } = await supabase
      .from('leave_deductions')
      .select('*')
      .eq('salary_payment_id', paymentId)
      .order('leave_date', { ascending: true });

    if (error) throw error;
    return data || [];
  }

  static async calculateLeaveDeductions(
    userId: string,
    paymentMonth: string
  ): Promise<{
    total_unpaid_days: number;
    total_deduction_amount: number;
    daily_rate: number;
  }> {
    const monthStart = new Date(paymentMonth + '-01');
    
    const { data, error } = await supabase
      .rpc('calculate_month_leave_deductions', {
        p_user_id: userId,
        p_payment_month: monthStart.toISOString().slice(0, 10)
      });

    if (error) throw error;
    return data?.[0] || {
      total_unpaid_days: 0,
      total_deduction_amount: 0,
      daily_rate: 0
    };
  }

  // Advanced leave deduction calculation with work days consideration
  static async calculateEmployeeLeaveDeductions(
    userId: string,
    paymentMonth: string,
    deductionPercentage: number = 100
  ): Promise<{
    employee_name: string;
    base_salary: number;
    work_days_in_month: number;
    daily_rate: number;
    unpaid_leave_days: number;
    leave_deduction_amount: number;
    net_salary: number;
    deduction_percentage: number;
  }> {
    const monthStart = new Date(paymentMonth + '-01');
    
    const { data, error } = await supabase
      .rpc('calculate_employee_leave_deductions', {
        p_user_id: userId,
        p_payment_month: monthStart.toISOString().slice(0, 10),
        p_deduction_percentage: deductionPercentage
      });

    if (error) throw error;
    return data?.[0] || {
      employee_name: 'Unknown',
      base_salary: 0,
      work_days_in_month: 0,
      daily_rate: 0,
      unpaid_leave_days: 0,
      leave_deduction_amount: 0,
      net_salary: 0,
      deduction_percentage: deductionPercentage
    };
  }

  // Get work days summary for an employee
  static async getEmployeeWorkDaysSummary(
    userId: string,
    paymentMonth: string
  ): Promise<{
    total_days_in_month: number;
    work_days_in_month: number;
    weekend_days: number;
    work_days_config: {
      monday: boolean;
      tuesday: boolean;
      wednesday: boolean;
      thursday: boolean;
      friday: boolean;
      saturday: boolean;
      sunday: boolean;
    };
  }> {
    const monthStart = new Date(paymentMonth + '-01');
    
    const { data, error } = await supabase
      .rpc('get_employee_work_days_summary', {
        p_user_id: userId,
        p_payment_month: monthStart.toISOString().slice(0, 10)
      });

    if (error) throw error;
    return data?.[0] || {
      total_days_in_month: 0,
      work_days_in_month: 0,
      weekend_days: 0,
      work_days_config: {
        monday: true,
        tuesday: true,
        wednesday: true,
        thursday: true,
        friday: true,
        saturday: false,
        sunday: false
      }
    };
  }

  // Utility Functions
  static formatCurrency(amount: number, currency: string = 'INR'): string {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  }

  static formatPercentage(value: number): string {
    return `${value.toFixed(1)}%`;
  }

  static getMonthName(monthString: string): string {
    const date = new Date(monthString + '-01');
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  }

  // Export Functions
  static async exportSalaryPayments(month: string): Promise<Blob> {
    const payments = await this.getSalaryPayments(month);
    
    const csvContent = [
      ['Employee Name', 'Base Salary', 'Leave Deductions', 'Unpaid Days', 'Net Salary', 'Status', 'Payment Date'],
      ...payments.map(payment => [
        payment.profiles?.name || 'N/A',
        this.formatCurrency(payment.base_salary),
        this.formatCurrency(payment.leave_deductions),
        payment.unpaid_leave_days.toString(),
        this.formatCurrency(payment.net_salary),
        payment.is_paid ? 'Paid' : 'Pending',
        payment.payment_date || 'N/A'
      ])
    ].map(row => row.join(',')).join('\n');

    return new Blob([csvContent], { type: 'text/csv' });
  }
}
