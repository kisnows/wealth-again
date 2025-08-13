import { createContext, useContext, useReducer, ReactNode } from 'react';

// 全局应用状态类型定义
interface AppState {
  user: {
    profile: any | null;
    preferences: any | null;
    loading: boolean;
  };
  notifications: {
    items: any[];
    unreadCount: number;
  };
  ui: {
    sidebarOpen: boolean;
    theme: 'light' | 'dark' | 'system';
    loading: {
      global: boolean;
      operations: Record<string, boolean>;
    };
  };
  cache: {
    accounts: any[] | null;
    incomeRecords: any[] | null;
    lastFetch: Record<string, number>;
  };
}

// 操作类型
type AppAction = 
  | { type: 'SET_USER_PROFILE'; payload: any }
  | { type: 'SET_USER_PREFERENCES'; payload: any }
  | { type: 'SET_USER_LOADING'; payload: boolean }
  | { type: 'ADD_NOTIFICATION'; payload: any }
  | { type: 'REMOVE_NOTIFICATION'; payload: string }
  | { type: 'MARK_NOTIFICATION_READ'; payload: string }
  | { type: 'TOGGLE_SIDEBAR' }
  | { type: 'SET_THEME'; payload: 'light' | 'dark' | 'system' }
  | { type: 'SET_GLOBAL_LOADING'; payload: boolean }
  | { type: 'SET_OPERATION_LOADING'; payload: { operation: string; loading: boolean } }
  | { type: 'UPDATE_CACHE'; payload: { key: keyof AppState['cache']; data: any } }
  | { type: 'INVALIDATE_CACHE'; payload: keyof AppState['cache'] | 'all' };

// 初始状态
const initialState: AppState = {
  user: {
    profile: null,
    preferences: null,
    loading: false,
  },
  notifications: {
    items: [],
    unreadCount: 0,
  },
  ui: {
    sidebarOpen: false,
    theme: 'system',
    loading: {
      global: false,
      operations: {},
    },
  },
  cache: {
    accounts: null,
    incomeRecords: null,
    lastFetch: {},
  },
};

// Reducer 函数
function appReducer(state: AppState, action: AppAction): AppState {
  switch (action.type) {
    case 'SET_USER_PROFILE':
      return {
        ...state,
        user: { ...state.user, profile: action.payload },
      };

    case 'SET_USER_PREFERENCES':
      return {
        ...state,
        user: { ...state.user, preferences: action.payload },
      };

    case 'SET_USER_LOADING':
      return {
        ...state,
        user: { ...state.user, loading: action.payload },
      };

    case 'ADD_NOTIFICATION':
      return {
        ...state,
        notifications: {
          items: [action.payload, ...state.notifications.items],
          unreadCount: state.notifications.unreadCount + 1,
        },
      };

    case 'REMOVE_NOTIFICATION':
      const filteredItems = state.notifications.items.filter(
        item => item.id !== action.payload
      );
      return {
        ...state,
        notifications: {
          items: filteredItems,
          unreadCount: filteredItems.filter(item => !item.isRead).length,
        },
      };

    case 'MARK_NOTIFICATION_READ':
      const updatedItems = state.notifications.items.map(item =>
        item.id === action.payload ? { ...item, isRead: true } : item
      );
      return {
        ...state,
        notifications: {
          items: updatedItems,
          unreadCount: updatedItems.filter(item => !item.isRead).length,
        },
      };

    case 'TOGGLE_SIDEBAR':
      return {
        ...state,
        ui: { ...state.ui, sidebarOpen: !state.ui.sidebarOpen },
      };

    case 'SET_THEME':
      return {
        ...state,
        ui: { ...state.ui, theme: action.payload },
      };

    case 'SET_GLOBAL_LOADING':
      return {
        ...state,
        ui: {
          ...state.ui,
          loading: { ...state.ui.loading, global: action.payload },
        },
      };

    case 'SET_OPERATION_LOADING':
      return {
        ...state,
        ui: {
          ...state.ui,
          loading: {
            ...state.ui.loading,
            operations: {
              ...state.ui.loading.operations,
              [action.payload.operation]: action.payload.loading,
            },
          },
        },
      };

    case 'UPDATE_CACHE':
      return {
        ...state,
        cache: {
          ...state.cache,
          [action.payload.key]: action.payload.data,
          lastFetch: {
            ...state.cache.lastFetch,
            [action.payload.key]: Date.now(),
          },
        },
      };

    case 'INVALIDATE_CACHE':
      if (action.payload === 'all') {
        return {
          ...state,
          cache: { ...initialState.cache },
        };
      }
      return {
        ...state,
        cache: {
          ...state.cache,
          [action.payload]: null,
          lastFetch: {
            ...state.cache.lastFetch,
            [action.payload]: 0,
          },
        },
      };

    default:
      return state;
  }
}

// Context 创建
const AppContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<AppAction>;
} | null>(null);

// Provider 组件
export function AppStateProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(appReducer, initialState);

  const contextValue = { state, dispatch };
  
  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
}

// 自定义 Hook
export function useAppState() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useAppState must be used within AppStateProvider');
  }
  return context;
}

// 便捷的操作 Hooks
export function useNotifications() {
  const { state, dispatch } = useAppState();

  return {
    notifications: state.notifications.items,
    unreadCount: state.notifications.unreadCount,
    addNotification: (notification: any) =>
      dispatch({ type: 'ADD_NOTIFICATION', payload: { ...notification, id: Date.now().toString() } }),
    removeNotification: (id: string) =>
      dispatch({ type: 'REMOVE_NOTIFICATION', payload: id }),
    markAsRead: (id: string) =>
      dispatch({ type: 'MARK_NOTIFICATION_READ', payload: id }),
  };
}

export function useLoading() {
  const { state, dispatch } = useAppState();

  return {
    globalLoading: state.ui.loading.global,
    operationLoading: state.ui.loading.operations,
    setGlobalLoading: (loading: boolean) =>
      dispatch({ type: 'SET_GLOBAL_LOADING', payload: loading }),
    setOperationLoading: (operation: string, loading: boolean) =>
      dispatch({ type: 'SET_OPERATION_LOADING', payload: { operation, loading } }),
    isLoading: (operation?: string) =>
      operation ? state.ui.loading.operations[operation] || false : state.ui.loading.global,
  };
}

export function useCache() {
  const { state, dispatch } = useAppState();

  return {
    cache: state.cache,
    updateCache: (key: keyof AppState['cache'], data: any) =>
      dispatch({ type: 'UPDATE_CACHE', payload: { key, data } }),
    invalidateCache: (key: keyof AppState['cache'] | 'all') =>
      dispatch({ type: 'INVALIDATE_CACHE', payload: key }),
    isCacheValid: (key: keyof AppState['cache'], ttlMs: number = 5 * 60 * 1000) => {
      const lastFetch = state.cache.lastFetch[key];
      return lastFetch && Date.now() - lastFetch < ttlMs;
    },
  };
}