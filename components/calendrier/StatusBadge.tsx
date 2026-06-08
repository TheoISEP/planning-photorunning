import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { Circle } from "lucide-react";

const statusBadgeVariants = cva(
	"inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors",
	{
		variants: {
			variant: {
				// Registration statuses (photographe)
				pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-300",
				available: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300",
				unavailable: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
				validated: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
				teamLeader: "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300",
				rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",

				// Processing statuses (admin only)
				inProgress: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300",
				done: "bg-gray-100 text-gray-800 dark:bg-gray-900/30 dark:text-gray-300",
			},
		},
		defaultVariants: {
			variant: "pending",
		},
	}
);

export type StatusBadgeVariant = VariantProps<typeof statusBadgeVariants>["variant"];

interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement>, VariantProps<typeof statusBadgeVariants> {
	showIcon?: boolean;
}

const statusLabels: Record<NonNullable<StatusBadgeVariant>, string> = {
	pending: "En attente",
	available: "Disponible",
	unavailable: "Pas dispo",
	validated: "Validé",
	teamLeader: "Référent",
	rejected: "Refusé",
	inProgress: "En cours",
	done: "Fait",
};

export function StatusBadge({ className, variant, showIcon = true, children, ...props }: StatusBadgeProps) {
	const label = variant ? statusLabels[variant] : children;

	return (
		<span className={cn(statusBadgeVariants({ variant }), className)} {...props}>
			{showIcon && <Circle className="h-2 w-2 fill-current" />}
			{label}
		</span>
	);
}
