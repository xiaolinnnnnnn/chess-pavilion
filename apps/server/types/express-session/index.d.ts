import 'express-session';
import type { SessionUser } from '@/auth/types';

declare module 'express-session' {
  interface SessionData {
    user?: SessionUser;
  }
}
