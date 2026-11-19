// Pure join rules (no DB, no server-only): shared by the feed, the joiner and the organizer endpoints.
// "joined" counts approved members only; the organizer takes one seat, so a trip is full at joined + 1 >= max.

import type { JoinState } from "@/shared/types";

export type TripGender = "male" | "female" | "mixed";
export type AccountGender = "male" | "female";
export type RequestStatus = "pending" | "approved" | "declined";
export type ViewerJoinState = JoinState;

export type JoinContext = {
  organizerId: string;
  status: "active" | "full" | "cancelled";
  departureDate: string; // YYYY-MM-DD
  maxTravelers: number;
  tripGender: TripGender;
  joined: number;
  isMember: boolean;
  requestStatus: RequestStatus | null;
};

export type RuleResult = { ok: true } | { ok: false; status: number; error: string };

const refuse = (status: number, error: string): RuleResult => ({ ok: false, status, error });

export function isTripFull(t: Pick<JoinContext, "status" | "joined" | "maxTravelers">): boolean {
  return t.status === "full" || t.joined + 1 >= t.maxTravelers;
}

export function genderAllows(tripGender: TripGender, userGender: AccountGender | null): boolean {
  return tripGender === "mixed" || tripGender === userGender;
}

export function ageOn(birthDate: string, today: string): number {
  const years = Number(today.slice(0, 4)) - Number(birthDate.slice(0, 4));
  return today.slice(5) < birthDate.slice(5) ? years - 1 : years;
}

export function viewerJoinState(v: {
  isMember: boolean;
  requestStatus: RequestStatus | null;
  full: boolean;
  tripGender: TripGender;
  userGender: AccountGender | null;
}): ViewerJoinState {
  if (v.isMember) return "joined";
  if (v.requestStatus === "pending") return "requested";
  if (v.requestStatus === "declined") return "declined";
  if (v.full) return "full";
  if (!genderAllows(v.tripGender, v.userGender)) return "wrong_gender";
  return "join";
}

export function fillsLastSeat(joinedAfter: number, max: number): boolean {
  return joinedAfter + 1 >= max;
}

export function checkCanRequest(ctx: JoinContext, user: { id: string; gender: AccountGender | null }, today: string): RuleResult {
  if (ctx.organizerId === user.id) return refuse(400, "You cannot join your own trip");
  if (ctx.status === "cancelled") return refuse(409, "This trip was cancelled");
  if (ctx.departureDate < today) return refuse(409, "This trip has already departed");
  if (ctx.isMember) return refuse(409, "You already joined this trip");
  if (ctx.requestStatus !== null) return refuse(409, "You already sent a request for this trip");
  if (isTripFull(ctx)) return refuse(409, "This trip is full");
  if (!genderAllows(ctx.tripGender, user.gender)) return refuse(409, "This trip is not open to your gender");
  return { ok: true };
}

export function checkCanApprove(ctx: JoinContext, applicantGender: AccountGender | null, today: string): RuleResult {
  if (ctx.status === "cancelled") return refuse(409, "This trip was cancelled");
  if (ctx.departureDate < today) return refuse(409, "This trip has already departed");
  if (isTripFull(ctx)) return refuse(409, "This trip is full");
  if (!genderAllows(ctx.tripGender, applicantGender)) return refuse(409, "This trip is not open to the applicant's gender");
  return { ok: true };
}

export function checkCanLeave(ctx: JoinContext, today: string): RuleResult {
  if (!ctx.isMember) return refuse(409, "You are not a member of this trip");
  if (ctx.departureDate < today) return refuse(409, "This trip has already departed");
  return { ok: true };
}
