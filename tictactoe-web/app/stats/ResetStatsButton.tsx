'use client';

import { useState } from 'react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { useRouter } from 'next/navigation';

interface ResetStatsButtonProps {
  userId: string;
}

export default function ResetStatsButton({ userId }: ResetStatsButtonProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const supabase = createClientComponentClient();
  const router = useRouter();

  const handleReset = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase.rpc('reset_user_stats', {
        user_id_param: userId
      });
      
      if (error) throw error;
      router.refresh();
    } catch (error) {
      console.error('Error resetting stats:', error);
    } finally {
      setIsLoading(false);
      setShowConfirm(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setShowConfirm(true)}
        className="btn-danger"
        disabled={isLoading}
      >
        Reset All Stats
      </button>

      {showConfirm && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-xl shadow-2xl max-w-md w-full mx-4">
            <h3 className="text-xl font-semibold text-gray-200 mb-4">
              Are you sure?
            </h3>
            <p className="text-gray-300 mb-6">
              This will permanently delete all your game statistics and match history. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-4">
              <button
                onClick={() => setShowConfirm(false)}
                className="px-4 py-2 bg-gray-700 text-white rounded-lg hover:bg-gray-600"
                disabled={isLoading}
              >
                Cancel
              </button>
              <button
                onClick={handleReset}
                className="btn-danger"
                disabled={isLoading}
              >
                {isLoading ? 'Resetting...' : 'Yes, Reset Everything'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
} 