import { GoogleSheetsService } from '../lib/google-sheets';
import * as dotenv from 'dotenv';
import * as path from 'path';

// Charger les variables d'environnement
dotenv.config({ path: path.join(__dirname, '../.env.local') });

async function check() {
  console.log('📋 Variables d\'environnement:');
  console.log('   GOOGLE_SPREADSHEET_ID:', process.env.GOOGLE_SPREADSHEET_ID ? '✓' : '✗');
  console.log('   GOOGLE_SERVICE_ACCOUNT_EMAIL:', process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL ? '✓' : '✗');
  console.log('   GOOGLE_PRIVATE_KEY:', process.env.GOOGLE_PRIVATE_KEY ? '✓' : '✗');
  console.log('');
  const sheetsService = new GoogleSheetsService();

  console.log('🔍 Vérification des données dans Google Sheets...\n');

  try {
    // Vérifier l'admin
    console.log('1️⃣ Recherche de l\'admin...');
    const admin = await sheetsService.findAdminByEmail('admin@photorun.com');
    if (admin) {
      console.log('✅ Admin trouvé:');
      console.log('   ID:', admin.id);
      console.log('   Email:', admin.email);
      console.log('   Nom:', admin.nom);
      console.log('   Role:', admin.role);
      console.log('   Actif:', admin.actif);
      console.log('   Password hash:', admin.password?.substring(0, 20) + '...');
    } else {
      console.log('❌ Admin NON trouvé!\n');
    }

    console.log('\n2️⃣ Recherche du photographe...');
    const photographer = await sheetsService.findPhotographerByEmail('sophie.martin@photorun.com');
    if (photographer) {
      console.log('✅ Photographe trouvé:');
      console.log('   ID:', photographer.id);
      console.log('   Email:', photographer.email);
      console.log('   Nom:', photographer.nom, photographer.prenom);
      console.log('   Actif:', photographer.actif);
    } else {
      console.log('❌ Photographe NON trouvé!\n');
    }

    console.log('\n3️⃣ Liste de toutes les courses...');
    const courses = await sheetsService.getAllCourses();
    console.log(`✅ ${courses.length} course(s) trouvée(s)`);
    if (courses.length > 0) {
      courses.forEach((course: any) => {
        console.log(`   - ${course.nom} (${course.id})`);
      });
    }

  } catch (error: any) {
    console.error('❌ Erreur:', error.message);
    console.error('\n💡 Vérifiez que:');
    console.error('   1. Le Google Sheet existe et contient les bonnes feuilles');
    console.error('   2. Le service account a les permissions d\'édition');
    console.error('   3. Les en-têtes des colonnes sont corrects');
  }
}

check().catch(console.error);
