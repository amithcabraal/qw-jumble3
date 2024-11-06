import { createClient } from '@supabase/supabase-js';
import { Game, Player } from '../types/game';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase credentials');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

export const gameService = {
  async createGame(hostId: string, word: string): Promise<string> {
    console.log('[QuizWordz] Creating new game', { hostId, word });
    
    const { data, error } = await supabase
      .from('games')
      .insert([{ 
        host_id: hostId, 
        word: word.toUpperCase(), 
        status: 'waiting', 
        players: [] 
      }])
      .select('id')
      .single();

    if (error) {
      console.error('[QuizWordz] Error creating game:', error);
      throw error;
    }
    
    console.log('[QuizWordz] Game created successfully:', data.id);
    return data.id;
  },

  subscribeToGame(gameId: string, callback: (game: Game) => void) {
    console.log('[QuizWordz Realtime] Subscribing to game updates:', gameId);
    
    const channel = supabase
      .channel(`game:${gameId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'games',
          filter: `id=eq.${gameId}`
        },
        async (payload) => {
          console.log('[QuizWordz Realtime] Received game update:', payload);
          
          // Fetch the latest game state to ensure we have the complete data
          const { data: game, error } = await supabase
            .from('games')
            .select('*')
            .eq('id', gameId)
            .single();
            
          if (error) {
            console.error('[QuizWordz Realtime] Error fetching game:', error);
            return;
          }
          
          callback({
            ...game,
            hostId: game.host_id,
            startedAt: game.started_at,
            endedAt: game.ended_at,
          });
        }
      )
      .subscribe((status) => {
        console.log('[QuizWordz Realtime] Subscription status for game', gameId + ':', status);
      });

    return channel;
  },

  async getGame(gameId: string) {
    console.log('[QuizWordz] Fetching game:', gameId);
    
    const { data, error } = await supabase
      .from('games')
      .select('*')
      .eq('id', gameId)
      .single();
      
    if (error) {
      console.error('[QuizWordz] Error fetching game:', error);
      throw error;
    }
    
    console.log('[QuizWordz] Game fetched successfully:', data);
    return { 
      data: {
        ...data,
        hostId: data.host_id,
        startedAt: data.started_at,
        endedAt: data.ended_at,
      }
    };
  },

  async joinGame(gameId: string, player: Omit<Player, 'guesses' | 'results' | 'solved'>) {
    console.log('[QuizWordz] Player joining game:', { gameId, player });
    
    const { error } = await supabase.rpc('join_game', {
      p_game_id: gameId,
      p_player: player
    });
    
    if (error) {
      console.error('[QuizWordz] Error joining game:', error);
      throw error;
    }
    
    console.log('[QuizWordz] Player joined successfully');
  },

  async submitGuess(gameId: string, playerId: string, guess: string) {
    console.log('[QuizWordz] Submitting guess:', { gameId, playerId, guess });
    
    // Get the current game to check the word
    const { data: game, error: gameError } = await supabase
      .from('games')
      .select('word')
      .eq('id', gameId)
      .single();
      
    if (gameError) throw gameError;
    
    // Calculate result
    const result = Array(5).fill(null).map((_, i) => {
      if (guess[i] === game.word[i]) return 'correct';
      if (game.word.includes(guess[i])) return 'present';
      return 'absent';
    });

    const { error } = await supabase.rpc('submit_guess', {
      p_game_id: gameId,
      p_guess: guess,
      p_player_id: playerId,
      p_result: result
    });
    
    if (error) {
      console.error('[QuizWordz] Error submitting guess:', error);
      throw error;
    }
    
    console.log('[QuizWordz] Guess submitted successfully');
  },

  async updateGameStatus(
    gameId: string, 
    status: 'waiting' | 'playing' | 'finished',
    startedAt?: number,
    endedAt?: number
  ) {
    console.log('[QuizWordz] Updating game status:', { gameId, status, startedAt, endedAt });
    
    const { error } = await supabase.rpc('update_game_status', {
      p_game_id: gameId,
      p_status: status,
      p_started_at: startedAt,
      p_ended_at: endedAt
    });
    
    if (error) {
      console.error('[QuizWordz] Error updating game status:', error);
      throw error;
    }
    
    console.log('[QuizWordz] Game status updated successfully');
  }
};