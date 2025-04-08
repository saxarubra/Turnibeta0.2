import { useState } from 'react';
import { Upload, FileUp, AlertCircle } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';

interface ShiftData {
  employee_code: string;
  sunday_shift?: string;
  monday_shift?: string;
  tuesday_shift?: string;
  wednesday_shift?: string;
  thursday_shift?: string;
  friday_shift?: string;
  saturday_shift?: string;
}

interface MatrixData {
  week_start_date: string;
  shifts: ShiftData[];
}

interface MatrixUploaderProps {
  onUploadSuccess: (date: string) => void;
}

export function MatrixUploader({ onUploadSuccess }: MatrixUploaderProps) {
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const { user } = useAuth();

  const validateShiftData = (shift: any, index: number): shift is ShiftData => {
    if (!shift || typeof shift !== 'object') {
      throw new Error(`Invalid shift data at index ${index}: must be an object`);
    }

    if (!shift.employee_code || typeof shift.employee_code !== 'string') {
      throw new Error(`Invalid shift data at index ${index}: employee_code is required and must be a string`);
    }

    const shiftFields = ['sunday_shift', 'monday_shift', 'tuesday_shift', 
                        'wednesday_shift', 'thursday_shift', 'friday_shift', 
                        'saturday_shift'];
    
    for (const field of shiftFields) {
      if (shift[field] !== undefined && typeof shift[field] !== 'string') {
        throw new Error(`Invalid shift data at index ${index}: ${field} must be a string if present`);
      }
    }

    return true;
  };

  const validateMatrixData = (data: any): data is MatrixData => {
    if (!data || typeof data !== 'object') {
      throw new Error('Invalid JSON format: must be an object');
    }

    if (!data.week_start_date) {
      throw new Error('Invalid JSON format: week_start_date is missing');
    }
    if (typeof data.week_start_date !== 'string') {
      throw new Error('Invalid JSON format: week_start_date must be a string');
    }

    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(data.week_start_date)) {
      throw new Error('Invalid JSON format: week_start_date must be in YYYY-MM-DD format');
    }

    if (!Array.isArray(data.shifts)) {
      throw new Error('Invalid JSON format: shifts must be an array');
    }
    if (data.shifts.length === 0) {
      throw new Error('Invalid JSON format: shifts array cannot be empty');
    }

    data.shifts.forEach((shift, index) => {
      validateShiftData(shift, index);
    });

    return true;
  };

  const saveToDB = async (data: MatrixData) => {
    // Check if user is admin
    if (user?.user_metadata?.full_name !== 'ADMIN') {
      throw new Error('Solo gli amministratori possono caricare la matrice dei turni');
    }

    // First delete all notifications
    await supabase
      .from('notifications')
      .delete()
      .filter('id', 'not.is', null);

    // Then delete all swaps
    await supabase
      .from('shift_swaps_v2')
      .delete()
      .filter('id', 'not.is', null);

    // Clear existing data for the week
    await supabase
      .from('shifts_schedule')
      .delete()
      .eq('week_start_date', data.week_start_date);

    // Insert the new shifts with display order
    for (let i = 0; i < data.shifts.length; i++) {
      const shift = data.shifts[i];
      const { error } = await supabase
        .from('shifts_schedule')
        .insert({
          week_start_date: data.week_start_date,
          employee_code: shift.employee_code,
          sunday_shift: shift.sunday_shift,
          monday_shift: shift.monday_shift,
          tuesday_shift: shift.tuesday_shift,
          wednesday_shift: shift.wednesday_shift,
          thursday_shift: shift.thursday_shift,
          friday_shift: shift.friday_shift,
          saturday_shift: shift.saturday_shift,
          display_order: i
        });

      if (error) throw error;
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setUploading(true);
    setError(null);
    setSuccess(false);

    try {
      if (!file.name.toLowerCase().endsWith('.json')) {
        throw new Error('Please upload a JSON file');
      }

      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const text = e.target?.result;
          if (typeof text !== 'string') {
            throw new Error('Invalid file content');
          }

          let data: unknown;
          try {
            data = JSON.parse(text);
          } catch (err) {
            throw new Error('Invalid JSON format: File contains malformed JSON');
          }

          validateMatrixData(data);
          await saveToDB(data as MatrixData);
          setSuccess(true);
          onUploadSuccess((data as MatrixData).week_start_date);
        } catch (err: any) {
          console.error('Error processing JSON:', err);
          setError(err.message || 'Error processing JSON file');
        }
      };

      reader.readAsText(file);
    } catch (err: any) {
      console.error('Error handling file:', err);
      setError(err.message || 'Error processing file');
    } finally {
      setUploading(false);
    }
  };

  // If not admin, don't render the uploader
  if (user?.user_metadata?.full_name !== 'ADMIN') {
    return (
      <div className="p-4 bg-red-50 rounded-md">
        <p className="text-sm text-red-700">
          Solo gli amministratori possono caricare la matrice dei turni
        </p>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white rounded-lg shadow-md">
      <div className="flex items-center justify-center w-full">
        <label className="flex flex-col items-center justify-center w-full h-64 border-2 border-gray-300 border-dashed rounded-lg cursor-pointer bg-gray-50 hover:bg-gray-100">
          <div className="flex flex-col items-center justify-center pt-5 pb-6">
            {uploading ? (
              <Upload className="w-10 h-10 mb-3 text-gray-400 animate-bounce" />
            ) : (
              <FileUp className="w-10 h-10 mb-3 text-gray-400" />
            )}
            <p className="mb-2 text-sm text-gray-500">
              <span className="font-semibold">Clicca per caricare</span> o trascina il file
            </p>
            <p className="text-xs text-gray-500">File JSON contenente la matrice dei turni</p>
          </div>
          <input
            type="file"
            className="hidden"
            accept=".json"
            onChange={handleFileUpload}
            disabled={uploading}
          />
        </label>
      </div>

      {error && (
        <div className="mt-4 p-4 bg-red-50 rounded-md flex items-start">
          <AlertCircle className="h-5 w-5 text-red-400 mt-0.5 mr-2" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {success && (
        <div className="mt-4 p-4 bg-green-50 rounded-md">
          <p className="text-sm text-green-700">
            Matrice caricata con successo!
          </p>
        </div>
      )}
    </div>
  );
}