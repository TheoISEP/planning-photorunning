import { GoogleSheetsService } from '../lib/google-sheets';
import bcrypt from 'bcryptjs';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Charger les variables d'environnement
dotenv.config({ path: path.join(__dirname, '../.env.local') });

async function seed() {
  console.log('📋 Vérification des variables d\'environnement...');
  if (!process.env.GOOGLE_SPREADSHEET_ID) {
    throw new Error('❌ GOOGLE_SPREADSHEET_ID manquant dans .env.local');
  }
  if (!process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL) {
    throw new Error('❌ GOOGLE_SERVICE_ACCOUNT_EMAIL manquant dans .env.local');
  }
  if (!process.env.GOOGLE_PRIVATE_KEY) {
    throw new Error('❌ GOOGLE_PRIVATE_KEY manquant dans .env.local');
  }
  console.log('✅ Variables d\'environnement chargées\n');
  const sheetsService = new GoogleSheetsService();

  console.log('🌱 Initialisation des données Google Sheets...\n');

  // ============================================================================
  // 1. ADMIN
  // ============================================================================
  console.log('👤 Création du compte admin...');
  const adminPassword = await bcrypt.hash('admin123', 10);

  try {
    await sheetsService.createAdmin({
      id: 'admin-001',
      email: 'admin@photorun.com',
      password: adminPassword,
      nom: 'Administrateur Principal',
      role: 'admin',
      dateCreation: new Date().toISOString(),
      actif: 'TRUE',
    });

    console.log('✅ Admin créé: admin@photorun.com / admin123\n');
  } catch (error) {
    console.log('⚠️  Admin déjà existant, on continue...\n');
  }

  // ============================================================================
  // 2. PHOTOGRAPHE
  // ============================================================================
  console.log('📷 Création du compte photographe...');
  const photographerPassword = await bcrypt.hash('password123', 10);

  try {
    await sheetsService.createPhotographer({
      id: 'photographe-001',
      email: 'sophie.martin@photorun.com',
      password: photographerPassword,
      nom: 'Martin',
      prenom: 'Sophie',
      telephone: '+33612345678',
      adresse: '123 Rue de la Photo',
      ville: 'Paris',
      codePostal: '75001',
      dateNaissance: '1990-05-15',
      dateInscription: new Date().toISOString(),
      actif: 'TRUE',
      cameras: JSON.stringify(['Canon EOS R5', 'Sony A7 IV']),
      objectifs: JSON.stringify(['Canon RF 24-70mm f/2.8', 'Sony FE 70-200mm f/2.8']),
      cartesMemoire: JSON.stringify(['SanDisk 128GB CFexpress', 'Sony 256GB SD']),
      flashs: JSON.stringify(['Godox V1']),
      flyingBlue: 'FB123456789',
      flyingBlueExpiry: '2026-12-31',
      sncf: 'SNCF987654321',
      sncfExpiry: '2027-06-30',
    });

    console.log('✅ Photographe créé: sophie.martin@photorun.com / password123\n');
  } catch (error) {
    console.log('⚠️  Photographe déjà existant, on continue...\n');
  }

  // ============================================================================
  // 3. COURSE D'EXEMPLE
  // ============================================================================
  console.log('🏃 Création d\'une course d\'exemple...');

  const courseId = 'course-001';
  try {
    await sheetsService.createCourse({
      id: courseId,
      nom: 'Marathon de Paris 2025',
      description: 'La plus grande course de Paris avec plus de 50 000 participants.',
      localisation: 'Paris, France',
      ville: 'Paris',
      dateDebut: '2025-06-15T09:00:00',
      dateFin: '2025-06-15T18:00:00',
      statutTraitement: 'inProgress',
      coureursAttendus: '50000',
      briefPdfUrl: '',
      dateCreation: new Date().toISOString(),
      creePar: 'admin-001',
      visible: 'TRUE',
    });

    console.log('✅ Course créée: Marathon de Paris 2025\n');
  } catch (error) {
    console.log('⚠️  Course déjà existante, on continue...\n');
  }

  // ============================================================================
  // 4. TARIF
  // ============================================================================
  console.log('💰 Création des tarifs...');

  try {
    await sheetsService.createTarif({
      id: 'tarif-001',
      courseId: courseId,
      tarifPhotographe: '450',
      bonusChefEquipe: '250',
      dateCreation: new Date().toISOString(),
      dateModification: new Date().toISOString(),
    });

    console.log('✅ Tarif créé: 450€ + 250€ bonus chef\n');
  } catch (error) {
    console.log('⚠️  Tarif déjà existant, on continue...\n');
  }

  // ============================================================================
  // 5. DISPONIBILITÉ
  // ============================================================================
  console.log('📅 Création de disponibilité...');

  try {
    await sheetsService.createDisponibilite({
      id: 'dispo-001',
      photographeId: 'photographe-001',
      courseId: courseId,
      statut: 'pending',
      dateDeclaration: new Date().toISOString(),
      dateModification: new Date().toISOString(),
      noteAdmin: '',
    });

    console.log('✅ Disponibilité créée (pending)\n');
  } catch (error) {
    console.log('⚠️  Disponibilité déjà existante, on continue...\n');
  }

  console.log('🎉 Initialisation terminée!\n');
  console.log('📋 Comptes créés:');
  console.log('   Admin: admin@photorun.com / admin123');
  console.log('   Photographe: sophie.martin@photorun.com / password123\n');
  console.log('🌐 Lancez le serveur avec: npm run dev');
  console.log('🔗 Puis ouvrez: http://localhost:3000/login\n');
}

seed().catch((error) => {
  console.error('❌ Erreur lors du seed:', error);
  process.exit(1);
});
