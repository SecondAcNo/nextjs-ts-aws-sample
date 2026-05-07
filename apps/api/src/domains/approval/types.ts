export const approvalTargetTypes = ["expense"] as const;

export type ApprovalTargetType = (typeof approvalTargetTypes)[number];

export const approvalActionTypes = ["approved", "rejected"] as const;

export type ApprovalActionType = (typeof approvalActionTypes)[number];

export type ApprovalHistory = {
  id: string;
  targetType: ApprovalTargetType;
  targetId: string;
  operatorUserId: string;
  action: ApprovalActionType;
  comment: string | null;
  createdAt: Date;
};