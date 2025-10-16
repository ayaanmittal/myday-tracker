import { supabase } from '@/integrations/supabase/client';

export interface EmployeeNote {
  id?: string;
  employee_id: string;
  created_by: string;
  note_date: string;
  note_time?: string;
  title: string;
  content: string;
  note_type: 'general' | 'salary_advance' | 'disciplinary' | 'performance' | 'leave' | 'other';
  is_private?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface EmployeeNoteWithDetails extends EmployeeNote {
  employee_name: string;
  created_by_name: string;
}

export interface CreateNoteRequest {
  employee_id: string;
  note_date: string;
  note_time?: string;
  title: string;
  content: string;
  note_type: 'general' | 'salary_advance' | 'disciplinary' | 'performance' | 'leave' | 'other';
  is_private?: boolean;
}

export interface UpdateNoteRequest {
  id: string;
  note_date?: string;
  note_time?: string;
  title?: string;
  content?: string;
  note_type?: 'general' | 'salary_advance' | 'disciplinary' | 'performance' | 'leave' | 'other';
  is_private?: boolean;
}

export class EmployeeNotesService {
  /**
   * Get all notes for a specific employee
   */
  static async getEmployeeNotes(
    employeeId: string,
    limit: number = 50,
    offset: number = 0
  ): Promise<{ notes: EmployeeNoteWithDetails[]; count: number }> {
    try {
      const { data: notes, error: notesError } = await supabase
        .rpc('get_employee_notes_with_details', {
          p_employee_id: employeeId,
          p_limit: limit,
          p_offset: offset
        });

      if (notesError) {
        console.error('Error fetching employee notes:', notesError);
        return { notes: [], count: 0 };
      }

      const { data: countData, error: countError } = await supabase
        .rpc('get_employee_notes_count', {
          p_employee_id: employeeId
        });

      if (countError) {
        console.error('Error fetching notes count:', countError);
        return { notes: notes || [], count: 0 };
      }

      return {
        notes: notes || [],
        count: countData || 0
      };
    } catch (error) {
      console.error('Error in getEmployeeNotes:', error);
      return { notes: [], count: 0 };
    }
  }

  /**
   * Create a new employee note
   */
  static async createNote(noteData: CreateNoteRequest): Promise<{ success: boolean; message: string; note?: EmployeeNote }> {
    try {
      // Get the current user ID
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        console.error('Error getting current user:', userError);
        return {
          success: false,
          message: 'Failed to get current user. Please log in again.'
        };
      }

      const { data, error } = await supabase
        .from('employee_notes')
        .insert({
          employee_id: noteData.employee_id,
          created_by: user.id, // Set the current user as the creator
          note_date: noteData.note_date,
          note_time: noteData.note_time || null,
          title: noteData.title,
          content: noteData.content,
          note_type: noteData.note_type,
          is_private: noteData.is_private ?? true
        })
        .select()
        .single();

      if (error) {
        console.error('Error creating employee note:', error);
        return {
          success: false,
          message: `Failed to create note: ${error.message}`
        };
      }

      return {
        success: true,
        message: 'Note created successfully',
        note: data
      };
    } catch (error) {
      console.error('Error in createNote:', error);
      return {
        success: false,
        message: 'Failed to create note'
      };
    }
  }

  /**
   * Update an existing employee note
   */
  static async updateNote(noteData: UpdateNoteRequest): Promise<{ success: boolean; message: string; note?: EmployeeNote }> {
    try {
      const updateData: any = {};
      
      if (noteData.note_date !== undefined) updateData.note_date = noteData.note_date;
      if (noteData.note_time !== undefined) updateData.note_time = noteData.note_time;
      if (noteData.title !== undefined) updateData.title = noteData.title;
      if (noteData.content !== undefined) updateData.content = noteData.content;
      if (noteData.note_type !== undefined) updateData.note_type = noteData.note_type;
      if (noteData.is_private !== undefined) updateData.is_private = noteData.is_private;

      const { data, error } = await supabase
        .from('employee_notes')
        .update(updateData)
        .eq('id', noteData.id)
        .select()
        .single();

      if (error) {
        console.error('Error updating employee note:', error);
        return {
          success: false,
          message: `Failed to update note: ${error.message}`
        };
      }

      return {
        success: true,
        message: 'Note updated successfully',
        note: data
      };
    } catch (error) {
      console.error('Error in updateNote:', error);
      return {
        success: false,
        message: 'Failed to update note'
      };
    }
  }

  /**
   * Delete an employee note
   */
  static async deleteNote(noteId: string): Promise<{ success: boolean; message: string }> {
    try {
      const { error } = await supabase
        .from('employee_notes')
        .delete()
        .eq('id', noteId);

      if (error) {
        console.error('Error deleting employee note:', error);
        return {
          success: false,
          message: `Failed to delete note: ${error.message}`
        };
      }

      return {
        success: true,
        message: 'Note deleted successfully'
      };
    } catch (error) {
      console.error('Error in deleteNote:', error);
      return {
        success: false,
        message: 'Failed to delete note'
      };
    }
  }

  /**
   * Get note count for a specific employee
   */
  static async getEmployeeNoteCount(employeeId: string): Promise<number> {
    try {
      const { count, error } = await supabase
        .from('employee_notes')
        .select('*', { count: 'exact', head: true })
        .eq('employee_id', employeeId);

      if (error) {
        console.error('Error getting note count:', error);
        return 0;
      }

      return count || 0;
    } catch (error) {
      console.error('Error in getEmployeeNoteCount:', error);
      return 0;
    }
  }

  /**
   * Get note types for dropdown
   */
  static getNoteTypes(): { value: string; label: string; description: string }[] {
    return [
      { value: 'general', label: 'General', description: 'General notes and observations' },
      { value: 'salary_advance', label: 'Salary Advance', description: 'Salary advance requests and approvals' },
      { value: 'disciplinary', label: 'Disciplinary', description: 'Disciplinary actions and warnings' },
      { value: 'performance', label: 'Performance', description: 'Performance reviews and feedback' },
      { value: 'leave', label: 'Leave', description: 'Leave requests and approvals' },
      { value: 'other', label: 'Other', description: 'Other administrative notes' }
    ];
  }
}
