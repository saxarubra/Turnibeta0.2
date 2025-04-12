import React, { useState } from 'react';
import { Upload } from 'lucide-react';
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
  [key: string]: string | undefined;
}

interface MatrixData {
  week_start_date: string;
  shifts: ShiftData[];
}

interface MatrixUploaderProps {
  onUploadComplete: (date: string) => void;
}

export function MatrixUploader({ onUploadComplete }: MatrixUploaderProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsLoading(true);
    setError(null);

    try {
      if (file.type === 'application/json') {
        const text = await file.text();
        const jsonData = JSON.parse(text);
        await handleJSONUpload(jsonData);
        onUploadComplete(jsonData.week_start_date);
      } else {
        throw new Error('Per favore carica un file JSON con il formato corretto.');
      }
    } catch (err) {
      console.error('Error uploading file:', err);
      setError(err instanceof Error ? err.message : 'Errore durante il caricamento del file');
    } finally {
      setIsLoading(false);
    }
  };

  const handleJSONUpload = async (data: MatrixData) => {
    if (!validateMatrixData(data)) {
      throw new Error('Formato dati non valido. Controlla il formato del file.');
    }

    const { error } = await supabase
      .from('shifts_schedule')
      .upsert(data.shifts.map(shift => ({
        ...shift,
        week_start_date: data.week_start_date
      })));

    if (error) throw error;
    onUploadComplete(data.week_start_date);
  };

  const validateMatrixData = (data: any): boolean => {
    if (!data || typeof data !== 'object') return false;
    if (!data.week_start_date || !Array.isArray(data.shifts)) return false;
    if (data.shifts.length === 0) return false;

    return data.shifts.every((shift: any) => 
      shift.employee_code &&
      typeof shift.employee_code === 'string' &&
      ['sunday_shift', 'monday_shift', 'tuesday_shift', 
       'wednesday_shift', 'thursday_shift', 'friday_shift', 
       'saturday_shift'].every(day => 
        !shift[day] || typeof shift[day] === 'string'
      )
    );
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
    <div className="p-4 bg-white rounded-lg shadow">
      <div className="flex flex-col items-center space-y-4">
        <label className="w-full max-w-xl flex flex-col items-center px-4 py-6 bg-white rounded-lg border-2 border-dashed border-gray-300 cursor-pointer hover:border-gray-400">
          <Upload className="w-8 h-8 text-gray-400" />
          <span className="mt-2 text-base text-gray-600">
            {isLoading ? 'Caricamento...' : 'Seleziona un file JSON'}
          </span>
          <input
            type="file"
            className="hidden"
            accept=".json"
            onChange={handleFileChange}
            disabled={isLoading}
          />
        </label>

        {error && (
          <div className="w-full max-w-xl p-4 text-red-700 bg-red-100 rounded">
            {error}
          </div>
        )}

        <div className="w-full max-w-xl mt-4">
          <h3 className="text-lg font-semibold mb-2">Formato JSON richiesto:</h3>
          <pre className="bg-gray-100 p-4 rounded text-sm overflow-auto">
{`{
  "week_start_date": "2025-03-30",
  "shifts": [
    {
      "employee_code": "CA",
      "sunday_shift": "RI",
      "monday_shift": "8.00",
      "tuesday_shift": "05.55+",
      "wednesday_shift": "05.55",
      "thursday_shift": "06.30",
      "friday_shift": "05.55",
      "saturday_shift": "NL"
    },
    ...
  ]
}`}
          </pre>
        </div>
      </div>
    </div>
  );
}