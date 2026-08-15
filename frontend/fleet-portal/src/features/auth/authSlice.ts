import { createSlice } from '@reduxjs/toolkit';
import type { PayloadAction } from '@reduxjs/toolkit';

interface AuthState {
  isAuthenticated: boolean;
  userName: string;
  userRole: string;
}

const getInitialAuthState = (): AuthState => {
  if (typeof window === 'undefined') {
    return {
      isAuthenticated: false,
      userName: '',
      userRole: 'User',
    };
  }

  return {
    isAuthenticated: Boolean(localStorage.getItem('authToken')),
    userName: localStorage.getItem('authUserName') ?? '',
    userRole: localStorage.getItem('authUserRole') ?? 'User',
  };
};

const initialState: AuthState = getInitialAuthState();

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    login(state, action: PayloadAction<{ userName: string; userRole: string }>) {
      state.isAuthenticated = true;
      state.userName = action.payload.userName;
      state.userRole = action.payload.userRole;
    },
    logout(state) {
      state.isAuthenticated = false;
      state.userName = '';
      state.userRole = 'User';
    },
  },
});

export const { login, logout } = authSlice.actions;
export default authSlice.reducer;
