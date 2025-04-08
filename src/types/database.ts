export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      shifts: {
        Row: {
          id: string
          user_id: string
          start_time: string
          end_time: string
          is_blocked: boolean
          status: 'scheduled' | 'swap_requested' | 'swapped'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          start_time: string
          end_time: string
          is_blocked?: boolean
          status?: 'scheduled' | 'swap_requested' | 'swapped'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          start_time?: string
          end_time?: string
          is_blocked?: boolean
          status?: 'scheduled' | 'swap_requested' | 'swapped'
          created_at?: string
          updated_at?: string
        }
      }
      shift_swaps: {
        Row: {
          id: string
          requester_shift_id: string
          requested_shift_id: string
          status: 'pending' | 'accepted' | 'declined'
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          requester_shift_id: string
          requested_shift_id: string
          status?: 'pending' | 'accepted' | 'declined'
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          requester_shift_id?: string
          requested_shift_id?: string
          status?: 'pending' | 'accepted' | 'declined'
          created_at?: string
          updated_at?: string
        }
      }
      users: {
        Row: {
          id: string
          role: 'admin' | 'user'
          full_name: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          role?: 'admin' | 'user'
          full_name?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          role?: 'admin' | 'user'
          full_name?: string | null
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}