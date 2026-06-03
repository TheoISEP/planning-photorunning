import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { GoogleSheetsService } from './google-sheets';

const JWT_SECRET = process.env.JWT_SECRET!;
const JWT_EXPIRES_IN = '7d';

export interface User {
  id: string;
  email: string;
  role: 'admin' | 'photographer';
  nom: string;
  prenom?: string;
}

export class AuthService {
  private sheetsService: GoogleSheetsService;

  constructor() {
    this.sheetsService = new GoogleSheetsService();
  }

  /**
   * Tente de connecter un utilisateur (admin ou photographe)
   */
  async login(email: string, password: string): Promise<{ user: User; token: string } | null> {
    // 1. Chercher d'abord dans la feuille Admin
    const admin = await this.sheetsService.findAdminByEmail(email);
    if (admin && admin.actif === 'TRUE') {
      const isValid = await bcrypt.compare(password, admin.password);
      if (isValid) {
        const user: User = {
          id: admin.id,
          email: admin.email,
          role: 'admin',
          nom: admin.nom,
        };
        const token = jwt.sign(user, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
        return { user, token };
      }
    }

    // 2. Sinon chercher dans la feuille Photographes
    const photographer = await this.sheetsService.findPhotographerByEmail(email);
    if (photographer && photographer.actif === 'TRUE') {
      const isValid = await bcrypt.compare(password, photographer.password);
      if (isValid) {
        const user: User = {
          id: photographer.id,
          email: photographer.email,
          role: 'photographer',
          nom: photographer.nom,
          prenom: photographer.prenom,
        };
        const token = jwt.sign(user, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
        return { user, token };
      }
    }

    return null;
  }

  /**
   * Vérifie un token JWT
   */
  verifyToken(token: string): User | null {
    try {
      const decoded = jwt.verify(token, JWT_SECRET) as User;
      return decoded;
    } catch {
      return null;
    }
  }

  /**
   * Hash un mot de passe (pour la création de compte)
   */
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, 10);
  }
}
