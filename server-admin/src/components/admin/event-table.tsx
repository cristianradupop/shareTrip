import type { AuditEventRow } from "server-app/shared";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { actionLabel, actorBadge, describeChange } from "@/lib/audit-format";

// Fixed UTC format so server and browser render the same text.
const when = (iso: string) => `${iso.slice(0, 10)} ${iso.slice(11, 16)} UTC`;

export function EventTable({ events, subjectHeading }: { events: AuditEventRow[]; subjectHeading: "Account" | "Trip" | "Account / Trip" }) {
  return (
    <div className="overflow-x-auto rounded-xl border bg-card">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>When</TableHead>
            <TableHead>{subjectHeading}</TableHead>
            <TableHead>What changed</TableHead>
            <TableHead>Who</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {events.length === 0 && (
            <TableRow>
              <TableCell colSpan={4} className="py-10 text-center text-muted-foreground">
                No events yet.
              </TableCell>
            </TableRow>
          )}
          {events.map((e) => {
            const detail = describeChange(e);
            const who = actorBadge({ actorRole: e.actor.role, actorName: e.actor.name });
            return (
              <TableRow key={e.id}>
                <TableCell className="whitespace-nowrap text-muted-foreground">{when(e.createdAt)}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{e.subject.label}</span>
                    {!e.subject.exists && <Badge variant="outline">deleted</Badge>}
                  </div>
                  {e.subject.email && <p className="text-xs text-muted-foreground">{e.subject.email}</p>}
                  {e.related && <p className="text-xs text-muted-foreground">Applicant: {e.related.label}</p>}
                </TableCell>
                <TableCell>
                  <p>{actionLabel(e.action)}</p>
                  {detail && <p className="text-xs text-muted-foreground">{detail}</p>}
                </TableCell>
                <TableCell>
                  <Badge variant="secondary">{who.label}</Badge>
                  {who.name && <span className="ml-2 text-sm">{who.name}</span>}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
}
