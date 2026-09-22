-- Planning PhotoRunning : schéma initial (migration depuis Google Sheets)

-- Enums
CREATE TYPE "UserRole" AS ENUM ('admin', 'photographer');
CREATE TYPE "CourseStatus" AS ENUM ('inProgress', 'done');
CREATE TYPE "Declaration" AS ENUM ('pending', 'available', 'unavailable');
CREATE TYPE "Decision" AS ENUM ('validated', 'teamLeader', 'rejected', 'nonPris');

-- Comptes
CREATE TABLE "user" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "emailVerified" BOOLEAN NOT NULL DEFAULT false,
    "image" TEXT,
    "role" "UserRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "nom" TEXT NOT NULL DEFAULT '',
    "prenom" TEXT NOT NULL DEFAULT '',
    "telephone" TEXT,
    "adresse" TEXT,
    "ville" TEXT,
    "codePostal" TEXT,
    "dateNaissance" TEXT,
    "dateInscription" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actif" BOOLEAN NOT NULL DEFAULT true,
    "cameras" JSONB NOT NULL DEFAULT '[]',
    "objectifs" JSONB NOT NULL DEFAULT '[]',
    "cartesMemoire" JSONB NOT NULL DEFAULT '[]',
    "flashs" JSONB NOT NULL DEFAULT '[]',
    "flyingBlue" TEXT,
    "flyingBlueExpiry" TEXT,
    "sncf" TEXT,
    "sncfExpiry" TEXT,
    "region" TEXT,
    "personUrgency" TEXT,
    "numberUrgency" TEXT,
    "inCharge" BOOLEAN NOT NULL DEFAULT false,
    "chargeOne" TEXT,
    "chargeTwo" TEXT,
    "chargeThree" TEXT,
    "chargeFour" TEXT,
    "chargeFive" TEXT,
    "accord" BOOLEAN NOT NULL DEFAULT false,
    "nonRemunere" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "user_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "session" (
    "id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "session_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "account" (
    "id" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "providerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "idToken" TEXT,
    "accessTokenExpiresAt" TIMESTAMP(3),
    "refreshTokenExpiresAt" TIMESTAMP(3),
    "scope" TEXT,
    "password" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "verification" (
    "id" TEXT NOT NULL,
    "identifier" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "verification_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "rateLimit" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "count" INTEGER NOT NULL,
    "lastRequest" BIGINT NOT NULL,

    CONSTRAINT "rateLimit_pkey" PRIMARY KEY ("id")
);

-- Planning
CREATE TABLE "course" (
    "id" TEXT NOT NULL,
    "nom" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "localisation" TEXT NOT NULL DEFAULT '',
    "ville" TEXT NOT NULL DEFAULT '',
    "dateDebut" TIMESTAMP(3) NOT NULL,
    "dateFin" TIMESTAMP(3) NOT NULL,
    "statutTraitement" "CourseStatus" NOT NULL DEFAULT 'inProgress',
    "doneAt" TIMESTAMP(3),
    "coureursAttendus" INTEGER,
    "numberAttended" INTEGER,
    "briefPdfUrl" TEXT,
    "dateCreation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "creePar" TEXT,
    "visible" BOOLEAN NOT NULL DEFAULT true,
    "archived" BOOLEAN NOT NULL DEFAULT false,
    "archivedAt" TIMESTAMP(3),
    "archivedBy" TEXT,
    "hotel" TEXT NOT NULL DEFAULT '',
    "transport" TEXT NOT NULL DEFAULT '',
    "supplementaire" TEXT NOT NULL DEFAULT '',
    "hotelValid" BOOLEAN NOT NULL DEFAULT false,
    "transportValid" BOOLEAN NOT NULL DEFAULT false,
    "hotelPrice" DOUBLE PRECISION,
    "transportPrice" DOUBLE PRECISION,
    "foodPrice" DOUBLE PRECISION,
    "comOrga" DOUBLE PRECISION,

    CONSTRAINT "course_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "tarif" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "nom" TEXT NOT NULL DEFAULT '',
    "ordre" INTEGER NOT NULL DEFAULT 0,
    "tarifPhotographe" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "bonusChefEquipe" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "nombreJours" INTEGER NOT NULL DEFAULT 1,
    "dateCreation" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateModification" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tarif_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "disponibilite" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "photographeId" TEXT NOT NULL,
    "tarifId" TEXT NOT NULL,
    "declaration" "Declaration" NOT NULL DEFAULT 'pending',
    "decision" "Decision",
    "published" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "noteAdmin" TEXT NOT NULL DEFAULT '',
    "dateDeclaration" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dateModification" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "disponibilite_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "monthly_cost" (
    "month" TEXT NOT NULL,
    "softCost" DOUBLE PRECISION NOT NULL DEFAULT 0,

    CONSTRAINT "monthly_cost_pkey" PRIMARY KEY ("month")
);

-- Index et contraintes
CREATE UNIQUE INDEX "user_email_key" ON "user"("email");
CREATE INDEX "user_role_actif_idx" ON "user"("role", "actif");
CREATE UNIQUE INDEX "session_token_key" ON "session"("token");
CREATE INDEX "session_userId_idx" ON "session"("userId");
CREATE INDEX "account_userId_idx" ON "account"("userId");
CREATE INDEX "verification_identifier_idx" ON "verification"("identifier");
CREATE UNIQUE INDEX "rateLimit_key_key" ON "rateLimit"("key");
CREATE INDEX "course_dateDebut_idx" ON "course"("dateDebut");
CREATE INDEX "course_archived_statutTraitement_idx" ON "course"("archived", "statutTraitement");
CREATE INDEX "tarif_courseId_ordre_idx" ON "tarif"("courseId", "ordre");
CREATE UNIQUE INDEX "disponibilite_courseId_photographeId_tarifId_key" ON "disponibilite"("courseId", "photographeId", "tarifId");
CREATE INDEX "disponibilite_photographeId_idx" ON "disponibilite"("photographeId");
CREATE INDEX "disponibilite_courseId_idx" ON "disponibilite"("courseId");

ALTER TABLE "session" ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "account" ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "tarif" ADD CONSTRAINT "tarif_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "disponibilite" ADD CONSTRAINT "disponibilite_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "course"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "disponibilite" ADD CONSTRAINT "disponibilite_photographeId_fkey" FOREIGN KEY ("photographeId") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "disponibilite" ADD CONSTRAINT "disponibilite_tarifId_fkey" FOREIGN KEY ("tarifId") REFERENCES "tarif"("id") ON DELETE CASCADE ON UPDATE CASCADE;
