import { Staff } from '@prisma/client';

declare global {
    namespace Express {
        interface Request {
            staff?: Staff & { roles: any[] };
            user?: any;
        }
    }
}
