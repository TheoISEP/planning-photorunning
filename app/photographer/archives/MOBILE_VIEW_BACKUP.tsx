// Ce fichier contient le code de la vue mobile que je vais intégrer dans archives/page.tsx
// À partir de la page planning

{/* Vue liste (mobile uniquement) */}
<div className="md:hidden flex-1 min-h-0 overflow-y-auto space-y-3 px-2">
  {sortedMonths.map((monthData) => {
    const monthKey = `${monthData.year}-${monthData.month}`;

    // Utiliser le photographe sélectionné pour la vue mobile
    const activePhotographerId = selectedPhotographerId || currentUser?.id;

    // Calculer le montant total du mois pour les courses validées (photographe actuel)
    const monthTotal = monthData.courses.reduce((total, course) => {
      if (!activePhotographerId) return total;
      const dispo = disponibilites.find((d) => d.courseId === course.id && d.photographeId === activePhotographerId);
      if (dispo && (dispo.statut === 'validated' || dispo.statut === 'teamLeader')) {
        const courseTarifs = tarifs.filter((t) => t.courseId === course.id);
        const courseTarif = dispo.tarifId
          ? tarifs.find((t) => t.id === dispo.tarifId)
          : courseTarifs[0];

        if (courseTarif) {
          const amount = dispo.statut === 'teamLeader'
            ? Number(courseTarif.tarifPhotographe) + Number(courseTarif.bonusChefEquipe)
            : Number(courseTarif.tarifPhotographe);
          return total + amount;
        }
      }
      return total;
    }, 0);

    // Calculer le total de tous les photographes
    const allPhotographersIds = [
      ...(currentUser ? [currentUser.id] : []),
      ...managedPhotographers.map(p => p.id)
    ];
    const allMonthTotal = monthData.courses.reduce((total, course) => {
      allPhotographersIds.forEach(photographerId => {
        const dispo = disponibilites.find((d) => d.courseId === course.id && d.photographeId === photographerId);
        if (dispo && (dispo.statut === 'validated' || dispo.statut === 'teamLeader')) {
          const courseTarifs = tarifs.filter((t) => t.courseId === course.id);
          const courseTarif = dispo.tarifId
            ? tarifs.find((t) => t.id === dispo.tarifId)
            : courseTarifs[0];

          if (courseTarif) {
            const amount = dispo.statut === 'teamLeader'
              ? Number(courseTarif.tarifPhotographe) + Number(courseTarif.bonusChefEquipe)
              : Number(courseTarif.tarifPhotographe);
            total += amount;
          }
        }
      });
      return total;
    }, 0);

    return (
      <div key={monthKey} className="space-y-2">
        {/* En-tête du mois */}
        <div className="sticky top-0 z-10 bg-gradient-to-r from-orange-100 to-orange-50 dark:from-orange-900 dark:to-orange-950 p-3 rounded-lg border-2 border-orange-300">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-base capitalize">
                {format(new Date(monthData.year, monthData.month), 'MMMM yyyy', { locale: fr })}
              </h3>
              {monthTotal > 0 && (
                <div className="text-xs text-orange-700 dark:text-orange-300 mt-0.5">
                  {activePhotographerId === currentUser?.id ? 'Mon total' : currentPhotographer?.prenom}: {monthTotal.toLocaleString('fr-FR')}€
                </div>
              )}
            </div>
            {allMonthTotal > 0 && (
              <span className="font-bold text-sm text-orange-700 dark:text-orange-300">
                Total: {allMonthTotal.toLocaleString('fr-FR')}€
              </span>
            )}
          </div>
        </div>

        {/* Cartes des courses */}
        {monthData.courses
          .filter((course) => {
            // Filtrer par photographe actif
            if (!activePhotographerId) return false;
            const dispo = disponibilites.find((d) => d.courseId === course.id && d.photographeId === activePhotographerId);
            // Afficher SEULEMENT les courses validées pour les archives
            return dispo && (dispo.statut === 'validated' || dispo.statut === 'teamLeader');
          })
          .map((course) => {
            const dispo = disponibilites.find((d) => d.courseId === course.id && d.photographeId === activePhotographerId);
            if (!dispo) return null;

            const courseTarifs = tarifs.filter((t) => t.courseId === course.id);
            const courseTarif = dispo.tarifId
              ? tarifs.find((t) => t.id === dispo.tarifId)
              : courseTarifs[0];

            const isTeamLeader = dispo.statut === 'teamLeader';

            return (
              <div
                key={course.id}
                className={cn(
                  'p-3 rounded-lg border-2 shadow-sm opacity-75',
                  isTeamLeader
                    ? 'bg-purple-50 dark:bg-purple-950/30 border-l-4 border-l-purple-600'
                    : 'bg-green-50 dark:bg-green-950/30 border-l-4 border-l-green-600'
                )}
              >
                {/* En-tête */}
                <div className="flex items-start justify-between mb-2">
                  <div className="flex-1">
                    <div className="flex items-center gap-1.5 mb-1">
                      <span className="text-sm">{isTeamLeader ? '👑' : '✓'}</span>
                      <h4 className="font-bold text-sm">{course.nom}</h4>
                      <span className="text-xs">🟢</span>
                    </div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      📍 {course.ville || course.localisation}
                    </p>
                  </div>
                  <Badge variant="secondary" className="text-xs ml-2">
                    {isTeamLeader ? 'Chef' : 'Validé'}
                  </Badge>
                </div>

                {/* Infos */}
                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <span className="font-medium">📅</span>
                    <span>{format(new Date(course.dateDebut), 'd MMM yyyy', { locale: fr })}</span>
                  </div>
                  {courseTarif && (
                    <div className="flex items-center gap-1">
                      <span className="font-medium">💶</span>
                      <span className="font-semibold text-foreground">
                        {isTeamLeader
                          ? `${Number(courseTarif.tarifPhotographe) + Number(courseTarif.bonusChefEquipe)}€ (chef)`
                          : `${courseTarif.tarifPhotographe}€`}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
      </div>
    );
  })}
</div>
