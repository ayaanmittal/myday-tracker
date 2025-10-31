import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { EmployeeNotesService, EmployeeNoteWithDetails, CreateNoteRequest } from '@/services/employeeNotesService';
import { FileText, Plus, Edit, Trash2, Calendar, Clock, User, Tag } from 'lucide-react';

interface EmployeeNotesDialogProps {
  employeeId: string;
  employeeName: string;
  trigger?: React.ReactNode;
  onNotesChange?: () => void;
}

export function EmployeeNotesDialog({ employeeId, employeeName, trigger, onNotesChange }: EmployeeNotesDialogProps) {
  const { toast } = useToast();
  const [notes, setNotes] = useState<EmployeeNoteWithDetails[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingNote, setEditingNote] = useState<EmployeeNoteWithDetails | null>(null);
  
  // Form state
  const [formData, setFormData] = useState({
    note_date: new Date().toISOString().split('T')[0],
    note_time: '',
    title: '',
    content: '',
    note_type: 'general' as const,
    amount: '',
    is_private: true
  });

  // Load notes on component mount
  useEffect(() => {
    loadNotes();
  }, [employeeId]);

  const loadNotes = async () => {
    setLoading(true);
    try {
      const { notes: fetchedNotes } = await EmployeeNotesService.getEmployeeNotes(employeeId);
      setNotes(fetchedNotes);
    } catch (error) {
      console.error('Error loading notes:', error);
      toast({
        title: 'Error',
        description: 'Failed to load employee notes',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (editingNote) {
        // Update existing note
        const result = await EmployeeNotesService.updateNote({
          id: editingNote.id!,
          note_date: formData.note_date,
          note_time: formData.note_time || undefined,
          title: formData.title,
          content: formData.content,
          note_type: formData.note_type,
          amount: formData.note_type === 'salary_advance' && formData.amount ? parseFloat(formData.amount) : undefined,
          is_private: formData.is_private
        });

        if (result.success) {
          toast({
            title: 'Success',
            description: 'Note updated successfully',
          });
          setEditingNote(null);
          resetForm();
          await loadNotes();
          onNotesChange?.(); // Notify parent component
        } else {
          toast({
            title: 'Error',
            description: result.message,
            variant: 'destructive',
          });
        }
      } else {
        // Create new note
        const noteData: CreateNoteRequest = {
          employee_id: employeeId,
          note_date: formData.note_date,
          note_time: formData.note_time || undefined,
          title: formData.title,
          content: formData.content,
          note_type: formData.note_type,
          amount: formData.note_type === 'salary_advance' && formData.amount ? parseFloat(formData.amount) : undefined,
          is_private: formData.is_private
        };

        const result = await EmployeeNotesService.createNote(noteData);

        if (result.success) {
          toast({
            title: 'Success',
            description: 'Note created successfully',
          });
          resetForm();
          setShowAddForm(false);
          await loadNotes();
          onNotesChange?.(); // Notify parent component
        } else {
          toast({
            title: 'Error',
            description: result.message,
            variant: 'destructive',
          });
        }
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to save note',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleEdit = (note: EmployeeNoteWithDetails) => {
    setEditingNote(note);
    setFormData({
      note_date: note.note_date,
      note_time: note.note_time || '',
      title: note.title,
      content: note.content,
      note_type: note.note_type,
      amount: note.amount ? note.amount.toString() : '',
      is_private: note.is_private
    });
    setShowAddForm(true);
  };

  const handleDelete = async (noteId: string) => {
    if (!confirm('Are you sure you want to delete this note?')) return;

    setLoading(true);
    try {
      const result = await EmployeeNotesService.deleteNote(noteId);

      if (result.success) {
        toast({
          title: 'Success',
          description: 'Note deleted successfully',
        });
        await loadNotes();
        onNotesChange?.(); // Notify parent component
      } else {
        toast({
          title: 'Error',
          description: result.message,
          variant: 'destructive',
        });
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete note',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      note_date: new Date().toISOString().split('T')[0],
      note_time: '',
      title: '',
      content: '',
      note_type: 'general',
      amount: '',
      is_private: true
    });
    setEditingNote(null);
  };

  const getNoteTypeColor = (type: string) => {
    const colors = {
      general: 'bg-gray-100 text-gray-800',
      salary_advance: 'bg-yellow-100 text-yellow-800',
      disciplinary: 'bg-red-100 text-red-800',
      performance: 'bg-blue-100 text-blue-800',
      leave: 'bg-green-100 text-green-800',
      other: 'bg-purple-100 text-purple-800'
    };
    return colors[type as keyof typeof colors] || colors.general;
  };

  const formatDateTime = (date: string, time?: string) => {
    const dateObj = new Date(date);
    const formattedDate = dateObj.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
    
    if (time) {
      return `${formattedDate} at ${time}`;
    }
    return formattedDate;
  };

  const noteTypes = EmployeeNotesService.getNoteTypes();

  return (
    <Dialog>
      <DialogTrigger asChild>
        {trigger || (
          <Button variant="outline" size="sm" className="flex items-center gap-2">
            <FileText className="h-4 w-4" />
            Notes
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Employee Notes - {employeeName}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Add/Edit Form */}
          {showAddForm && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  {editingNote ? <Edit className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                  {editingNote ? 'Edit Note' : 'Add New Note'}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="note_date">Date</Label>
                      <Input
                        id="note_date"
                        type="date"
                        value={formData.note_date}
                        onChange={(e) => setFormData({ ...formData, note_date: e.target.value })}
                        required
                      />
                    </div>
                    <div>
                      <Label htmlFor="note_time">Time (Optional)</Label>
                      <Input
                        id="note_time"
                        type="time"
                        value={formData.note_time}
                        onChange={(e) => setFormData({ ...formData, note_time: e.target.value })}
                      />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="title">Title</Label>
                    <Input
                      id="title"
                      value={formData.title}
                      onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                      placeholder="Enter note title"
                      required
                    />
                  </div>

                  <div>
                    <Label htmlFor="note_type">Note Type</Label>
                    <Select
                      value={formData.note_type}
                      onValueChange={(value) => setFormData({ ...formData, note_type: value as any })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {noteTypes.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            <div className="flex flex-col">
                              <span>{type.label}</span>
                              <span className="text-xs text-muted-foreground">{type.description}</span>
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {formData.note_type === 'salary_advance' && (
                    <div>
                      <Label htmlFor="amount">Amount (₹)</Label>
                      <Input
                        id="amount"
                        type="number"
                        value={formData.amount}
                        onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                        placeholder="Enter advance amount"
                        min="0"
                        step="0.01"
                        required
                      />
                    </div>
                  )}

                  <div>
                    <Label htmlFor="content">Content</Label>
                    <Textarea
                      id="content"
                      value={formData.content}
                      onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                      placeholder="Enter note content"
                      rows={4}
                      required
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="is_private"
                      checked={formData.is_private}
                      onChange={(e) => setFormData({ ...formData, is_private: e.target.checked })}
                    />
                    <Label htmlFor="is_private">Private note (admin only)</Label>
                  </div>

                  <div className="flex gap-2">
                    <Button type="submit" disabled={loading}>
                      {loading ? 'Saving...' : (editingNote ? 'Update Note' : 'Create Note')}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        resetForm();
                        setShowAddForm(false);
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          )}

          {/* Notes List */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-medium">Notes ({notes.length})</h3>
              {!showAddForm && (
                <Button onClick={() => setShowAddForm(true)} className="flex items-center gap-2">
                  <Plus className="h-4 w-4" />
                  Add Note
                </Button>
              )}
            </div>

            {loading && notes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">Loading notes...</div>
            ) : notes.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No notes found for this employee.
              </div>
            ) : (
              <div className="space-y-3">
                {notes.map((note) => (
                  <Card key={note.id} className="border-l-4 border-l-blue-500">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 space-y-2">
                          <div className="flex items-center gap-2">
                            <h4 className="font-medium">{note.title}</h4>
                            <Badge className={getNoteTypeColor(note.note_type)}>
                              {noteTypes.find(t => t.value === note.note_type)?.label}
                            </Badge>
                            {note.is_private && (
                              <Badge variant="secondary" className="text-xs">
                                Private
                              </Badge>
                            )}
                          </div>
                          
                          <p className="text-sm text-muted-foreground">{note.content}</p>
                          
                          {note.note_type === 'salary_advance' && (
                            <div className="text-sm font-medium text-green-600">
                              Amount: {note.amount ? `₹${note.amount.toLocaleString()}` : 'Not specified'}
                            </div>
                          )}
                          
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <div className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              {formatDateTime(note.note_date, note.note_time)}
                            </div>
                            <div className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {note.created_by_name}
                            </div>
                            <div className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {new Date(note.created_at!).toLocaleString()}
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(note)}
                            disabled={loading}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(note.id!)}
                            disabled={loading}
                            className="text-red-600 hover:text-red-700"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
