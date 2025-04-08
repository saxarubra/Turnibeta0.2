import { useEffect, useState } from 'react';
import { ArrowLeftRight, X } from 'lucide-react';
import { supabase } from '../../lib/supabase';

type SwapRecord = {
  id: string;
  date: string;
  from_employee: string;
  to_employee: string;
  from_shift: string;
  to_shift: string;
  created_at: string;
};

export function SwapsPage({ onClose }: { onClose: () => void }) {
  const [swaps, setSwaps] = useState<SwapRecord[]>([]);

  useEffect(() => {
    const loadSwaps = async () => {
      const { data, error } = await supabase
        .from('shift_swaps_v2')
        .select('*')
        .order('created_at', { ascending: false });

      if (!error && data) {
        setSwaps(data);
      }
    };

    loadSwaps();
  }, []);

  return (
    <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50">
      <div className="relative top-20 mx-auto p-5 border w-full max-w-2xl shadow-lg rounded-md bg-white">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-gray-800">Shift Swaps History</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700"
          >
            <X className="h-6 w-6" />
          </button>
        </div>
        
        <div className="space-y-4">
          {swaps.map((swap) => (
            <div
              key={swap.id}
              className="bg-gray-50 p-4 rounded-lg flex items-center space-x-3"
            >
              <ArrowLeftRight className="h-5 w-5 text-gray-400 flex-shrink-0" />
              <div className="flex-1">
                <p className="text-sm text-gray-900">
                  <span className="font-medium">{swap.from_employee}</span>
                  {' ('}{swap.from_shift}{') '}
                  <span className="text-gray-500">swapped with</span>
                  {' '}
                  <span className="font-medium">{swap.to_employee}</span>
                  {' ('}{swap.to_shift}{')'}
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  {new Date(swap.created_at).toLocaleDateString()} at{' '}
                  {new Date(swap.created_at).toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))}
          
          {swaps.length === 0 && (
            <p className="text-center text-gray-500 py-4">No swaps recorded yet</p>
          )}
        </div>
      </div>
    </div>
  );
}