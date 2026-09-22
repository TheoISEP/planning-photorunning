-- Course annulée
ALTER TABLE "course" ADD COLUMN "annulee" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "course" ADD COLUMN "annuleeAt" TIMESTAMP(3);
