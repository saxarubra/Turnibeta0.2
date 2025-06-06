import React, { useState, useEffect } from 'react';
import { Check, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import PDFExport from './PDFExport';
import { PDFDocument } from 'pdf-lib';

type Matrix = string[][];
type SwapRequest = {
  id: string;
  date: string;
  fromEmployee: string;
  toEmployee: string;
  fromShift: string;
  toShift: string;
  status: 'pending' | 'accepted' | 'rejected' | 'cancelled';
};

interface ShiftListProps {
  initialDate?: string | null;
}

export default function ShiftList({ initialDate }: ShiftListProps) {
  const [matrix, setMatrix] = useState<Matrix>([]);
  const [selectedCells, setSelectedCells] = useState<[number, number][]>([]);
  const [swaps, setSwaps] = useState<SwapRequest[]>([]);
  const [currentWeekStart, setCurrentWeekStart] = useState(initialDate ? new Date(initialDate) : new Date());
  const [showUploader, setShowUploader] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { user } = useAuth();
  const [uploadedJson, setUploadedJson] = useState<any>(null);

  const currentEmployeeCode = user?.user_metadata?.full_name;

  useEffect(() => {
    if (user) {
      checkAdminStatus();
      loadMatrix(currentWeekStart);
      loadSwaps();

      // Imposta un intervallo per ricaricare i dati ogni 5 secondi
      const intervalId = setInterval(() => {
        loadSwaps();
        loadMatrix(currentWeekStart);
      }, 5000);

      // Subscription per gli scambi in tempo reale
      const channel = supabase.channel('realtime-shifts')
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'shift_swaps_v2',
          },
          async () => {
            // Ricarica sia gli scambi che la matrice
            await loadSwaps();
            await loadMatrix(currentWeekStart);
          }
        )
        .subscribe();

      return () => {
        channel.unsubscribe();
        clearInterval(intervalId);
      };
    }
  }, [user, currentWeekStart]);

  const checkAdminStatus = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('role')
        .eq('id', user?.id)
        .maybeSingle();

      if (error) throw error;
      setIsAdmin(data?.role === 'admin' || false);
    } catch (err) {
      console.error('Error checking admin status:', err);
      setIsAdmin(false);
    }
  };

  const loadMatrix = async (startDate: Date) => {
    try {
      const formattedDate = startDate.toISOString().split('T')[0];
      
      const { data: scheduleData, error } = await supabase
        .from('shifts_schedule')
        .select('*')
        .eq('week_start_date', formattedDate)
        .order('display_order', { ascending: true });

      if (error) throw error;

      if (scheduleData && scheduleData.length > 0) {
        const weekDates = getWeekDates(startDate);
        const headerRow = ["", ...weekDates.map(d => d.full)];
        const daysRow = ["", ...weekDates.map(d => d.day)];
        
        const matrixData = scheduleData.map(row => [
          row.employee_code,
          row.sunday_shift || '',
          row.monday_shift || '',
          row.tuesday_shift || '',
          row.wednesday_shift || '',
          row.thursday_shift || '',
          row.friday_shift || '',
          row.saturday_shift || ''
        ]);

        setMatrix([headerRow, daysRow, ...matrixData]);
      } else {
        // Se non ci sono dati, controlla se ci sono dati per altre date
        const { data: latestData, error: latestError } = await supabase
          .from('shifts_schedule')
          .select('week_start_date')
          .order('week_start_date', { ascending: false })
          .limit(1)
          .single();

        if (!latestError && latestData) {
          // Se esistono dati per un'altra data, carica quelli
          const newDate = new Date(latestData.week_start_date);
          setCurrentWeekStart(newDate);
          loadMatrix(newDate);
        } else {
          setMatrix([]);
        }
      }
    } catch (err) {
      console.error('Error loading matrix:', err);
      setError('Errore nel caricamento dei turni');
    }
  };

  const getWeekDates = (startDate: Date) => {
    const dates = [];
    const days = ['Dom', 'Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab'];
    
    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      dates.push({
        full: date.toLocaleDateString('it-IT'),
        day: days[i]
      });
    }
    return dates;
  };

  const loadSwaps = async () => {
    try {
      const { data, error } = await supabase
        .from('shift_swaps_v2')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (data) {
        // Filtra i duplicati basandosi sulla data e sulle persone coinvolte
        const uniqueSwaps = data.reduce<Record<string, any>>((acc, swap) => {
          const key = `${swap.date}-${swap.from_employee}-${swap.to_employee}`;
          if (!acc[key]) {
            acc[key] = swap;
          }
          return acc;
        }, {});

        setSwaps(Object.values(uniqueSwaps).map(swap => ({
          id: swap.id,
          date: swap.date,
          fromEmployee: swap.from_employee,
          toEmployee: swap.to_employee,
          fromShift: swap.from_shift,
          toShift: swap.to_shift,
          status: swap.status
        })));
      }
    } catch (err) {
      console.error('Error loading swaps:', err);
    }
  };

  const getFinalShift = (row: number, col: number): string => {
    const date = matrix[0][col];
    const employeeCode = matrix[row][0];
    const baseShift = matrix[row][col];
    
    if (col === 0) return baseShift;

    const formattedDate = date.split('/').reverse().join('-');
    
    // Cerca solo gli scambi accettati per questa data e questa sigla
    const swap = swaps.find(s => 
      s.status === 'accepted' && 
      s.date === formattedDate &&
      (s.fromEmployee === employeeCode || s.toEmployee === employeeCode)
    );

    // Se non ci sono scambi, ritorna il turno base
    if (!swap) return baseShift;

    // Se la sigla è quella che ha fatto la richiesta, ritorna il turno di destinazione
    if (swap.fromEmployee === employeeCode) {
      return swap.toShift;
    }

    // Se la sigla è quella che ha ricevuto la richiesta, ritorna il turno di origine
    return swap.fromShift;
  };

  const handleCellClick = async (row: number, col: number) => {
    if (col === 0) return;

    const employeeCode = matrix[row][0];
    const date = matrix[0][col];

    setSelectedCells(prev => {
      if (prev.length === 0) {
        // Prima selezione
        if (isAdmin) {
          return [[row, col]];
        } else {
          if (employeeCode !== currentEmployeeCode) {
            return prev;
          }
          return [[row, col]];
        }
      }
      
      if (prev.length === 1) {
        const [firstRow, firstCol] = prev[0];
        
        if (firstRow === row && firstCol === col) {
          return [];
        }

        // Se non è admin, permette solo scambi nella stessa colonna (stessa data)
        if (!isAdmin && firstCol !== col) {
          return prev;
        }

        const fromEmployee = matrix[firstRow][0];
        const toEmployee = matrix[row][0];
        const fromDate = matrix[0][firstCol];
        const toDate = matrix[0][col];
        const fromShift = getFinalShift(firstRow, firstCol);
        const toShift = getFinalShift(row, col);

        // Se è admin, crea un solo scambio invece di due
        if (isAdmin && fromDate !== toDate) {
          createSwapRequest(fromDate, fromEmployee, toEmployee, fromShift, toShift, true);
        } else {
          createSwapRequest(date, fromEmployee, toEmployee, fromShift, toShift, isAdmin);
        }
        return [];
      }
      
      return prev;
    });
  };

  const createNotification = async (userId: string, message: string, type: string, swapId: string) => {
    try {
      await supabase.from('notifications').insert({
        user_id: userId,
        message,
        type,
        related_swap_id: swapId
      });
    } catch (error) {
      console.error('Error creating notification:', error);
    }
  };

  const handleSwapRequest = async (fromDate: string, fromEmployee: string, toEmployee: string, fromShift: string, toShift: string) => {
    if (isLoading) return;

    try {
      setIsLoading(true);
      setError(null);

      // Verifica le restrizioni per gli account non admin
      if (!isAdmin) {
        // Impedisci lo scambio di RI e NL
        if (fromShift === 'RI' || fromShift === 'NL' || toShift === 'RI' || toShift === 'NL') {
          setError('Non è possibile scambiare i turni RI e NL');
          return;
        }

        // Impedisci lo scambio della prima colonna (sigle)
        const fromShiftIndex = matrix[0].findIndex(s => s === fromShift);
        if (fromShiftIndex === 0) {
          setError('Non è possibile scambiare i turni della prima colonna');
          return;
        }
      }

      // Procedi con la creazione della richiesta di scambio
      const { error: insertError } = await supabase
        .from('shift_swaps_v2')
        .insert({
          date: fromDate.split('/').reverse().join('-'),
          from_employee: fromEmployee,
          to_employee: toEmployee,
          from_shift: fromShift,
          to_shift: toShift,
          // Lo scambio viene accettato automaticamente SOLO se l'utente corrente è admin
          status: isAdmin ? 'accepted' : 'pending'
        });

      if (insertError) throw insertError;
      await loadSwaps();
      // Se l'admin ha fatto lo scambio, aggiorna immediatamente la matrice
      if (isAdmin) {
        await loadMatrix(currentWeekStart);
      }

    } catch (err) {
      console.error('Error creating swap request:', err);
      setError('Errore nella creazione della richiesta di scambio');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSwapResponse = async (swapId: string, accept: boolean) => {
    if (isLoading) return;

    try {
      setIsLoading(true);
      setError(null);

      const swap = swaps.find(s => s.id === swapId);
      if (!swap) return;

      // Solo l'admin può accettare/rifiutare qualsiasi scambio
      // Gli utenti normali possono solo accettare/rifiutare scambi proposti a loro
      if (!isAdmin && swap.toEmployee !== currentEmployeeCode) {
        setError('Non autorizzato a rispondere a questa richiesta');
        return;
      }

      const { error: updateError } = await supabase
        .from('shift_swaps_v2')
        .update({ status: accept ? 'accepted' : 'rejected' })
        .eq('id', swapId);

      if (updateError) throw updateError;
      
      await loadSwaps();
      if (accept) {
        await loadMatrix(currentWeekStart);
      }

    } catch (err) {
      console.error('Error updating swap:', err);
      setError('Errore nell\'aggiornamento della richiesta di scambio');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancelSwap = async (swapId: string) => {
    if (isLoading) return;

    try {
      setIsLoading(true);

      const { error: updateError } = await supabase
        .from('shift_swaps_v2')
        .update({ status: 'cancelled' })
        .eq('id', swapId);

      if (updateError) throw updateError;
      await loadSwaps();
    } catch (err) {
      console.error('Error cancelling swap:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const getSwapForCell = (row: number, col: number) => {
    if (col === 0) return null;

    const date = matrix[0][col];
    const employeeCode = matrix[row][0];
    const currentShift = getFinalShift(row, col);

    return swaps.find(swap => 
      swap.status === 'pending' &&
      swap.date === date.split('/').reverse().join('-') &&
      ((swap.fromEmployee === employeeCode && swap.fromShift === currentShift) ||
       (swap.toEmployee === employeeCode && swap.toShift === currentShift))
    );
  };

  const formatDate = (dateStr: string) => {
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  };

  async function convertPdfToJson(file: File) {
    const arrayBuffer = await file.arrayBuffer();
    const pdfDoc = await PDFDocument.load(arrayBuffer);
    const pages = pdfDoc.getPages();
    const jsonData = { week_start_date: '', shifts: [] };

    // Example logic to extract data from the PDF
    pages.forEach((page) => {
      // Manually extract and parse text content from the page
      // This is a placeholder for actual parsing logic
      // jsonData.shifts.push({ employee_code: 'CA', ... });
    });

    return jsonData;
  }

  const handleJsonUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const text = await file.text();
      const jsonData = JSON.parse(text);
      setUploadedJson(jsonData);
    }
  };

  const handlePdfUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const jsonData = await convertPdfToJson(file);
      setUploadedJson(jsonData);
    }
  };

  const createSwapRequest = async (date: string, fromEmployee: string, toEmployee: string, fromShift: string, toShift: string, autoAccept: boolean = false) => {
    try {
      setIsLoading(true);
      setError(null);

      const { error: insertError } = await supabase
        .from('shift_swaps_v2')
        .insert({
          date: date.split('/').reverse().join('-'),
          from_employee: fromEmployee,
          to_employee: toEmployee,
          from_shift: fromShift,
          to_shift: toShift,
          status: autoAccept ? 'accepted' : 'pending'
        });

      if (insertError) throw insertError;
      await loadSwaps(); // Ricarica gli scambi immediatamente
      
    } catch (err) {
      console.error('Error creating swap request:', err);
      setError('Errore nella creazione della richiesta di scambio');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-600">
            {currentWeekStart.toLocaleDateString('it-IT')} - {new Date(currentWeekStart.getTime() + 6 * 24 * 60 * 60 * 1000).toLocaleDateString('it-IT')}
          </span>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 text-red-700 p-4 rounded-md">
          {error}
        </div>
      )}

      <div className="overflow-x-auto">
        {matrix.length > 0 ? (
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {matrix[1]?.map((day, index) => (
                  <th key={index} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {day}
                  </th>
                ))}
              </tr>
              <tr>
                {matrix[0]?.map((date, index) => (
                  <th key={index} className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    {date}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {matrix.slice(2).map((row, rowIndex) => (
                <tr key={rowIndex}>
                  {row.map((cell, colIndex) => {
                    const swap = getSwapForCell(rowIndex + 2, colIndex);
                    const isSelected = selectedCells.some(([r, c]) => r === rowIndex + 2 && c === colIndex);
                    const isCurrentUser = row[0] === currentEmployeeCode;
                    const finalShift = getFinalShift(rowIndex + 2, colIndex);

                    return (
                      <td
                        key={colIndex}
                        onClick={() => handleCellClick(rowIndex + 2, colIndex)}
                        className={`px-6 py-4 whitespace-nowrap relative ${
                          colIndex === 0 ? 'font-medium text-gray-900' : 'text-gray-500'
                        } cursor-pointer ${isSelected ? 'bg-yellow-100' : ''} ${
                          isCurrentUser || isAdmin ? 'hover:bg-gray-50' : ''
                        }`}
                      >
                        {swap ? (
                          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-2">
                            <div className="font-medium">{finalShift}</div>
                            <div className="text-xs text-yellow-600">
                              {swap.toEmployee === row[0] ? (
                                <div className="flex items-center gap-2">
                                  <span>Richiesta da {swap.fromEmployee}</span>
                                  <div className="flex gap-1">
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleSwapResponse(swap.id, true);
                                      }}
                                      className="p-1 hover:bg-green-100 rounded disabled:opacity-50"
                                      disabled={isLoading}
                                      title="Accetta scambio"
                                    >
                                      <Check className="h-4 w-4 text-green-600" />
                                    </button>
                                    <button
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleSwapResponse(swap.id, false);
                                      }}
                                      className="p-1 hover:bg-red-100 rounded disabled:opacity-50"
                                      disabled={isLoading}
                                      title="Rifiuta scambio"
                                    >
                                      <X className="h-4 w-4 text-red-600" />
                                    </button>
                                  </div>
                                </div>
                              ) : (
                                <div className="flex items-center justify-between">
                                  <span>In attesa di {swap.toEmployee}</span>
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleCancelSwap(swap.id);
                                    }}
                                    className="p-1 hover:bg-red-100 rounded disabled:opacity-50"
                                    disabled={isLoading}
                                    title="Annulla richiesta"
                                  >
                                    <X className="h-4 w-4 text-red-600" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div>{finalShift}</div>
                        )}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="text-center py-8 text-gray-500">
            Nessun turno disponibile. Carica una nuova matrice.
          </div>
        )}
      </div>

      {/* Storico Scambi */}
      <div className="mt-8">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Storico Scambi</h3>
        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Data</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Da</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">A</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Stato</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {swaps.map((swap) => (
                  <tr key={swap.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{formatDate(swap.date)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {swap.fromEmployee} ({swap.fromShift})
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {swap.toEmployee} ({swap.toShift})
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${
                        swap.status === 'accepted' ? 'bg-green-100 text-green-800' :
                        swap.status === 'rejected' ? 'bg-red-100 text-red-800' :
                        swap.status === 'cancelled' ? 'bg-gray-100 text-gray-800' :
                        'bg-yellow-100 text-yellow-800'
                      }`}>
                        {swap.status === 'accepted' ? 'Accettato' :
                         swap.status === 'rejected' ? 'Rifiutato' :
                         swap.status === 'cancelled' ? 'Annullato' :
                         'In attesa'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <PDFExport matrix={matrix} />
    </div>
  );
}