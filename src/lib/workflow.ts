import type { ApprovalRecord, ApprovalStage, Episode } from '../../shared/types';

export type WfAction =
  | 'submit'
  | 'approve'
  | 'requestChanges'
  | 'reject'
  | 'resubmit'
  | 'startProduction'
  | 'submitFinal'
  | 'publish'
  | 'reopen';

export interface WfActionDef {
  action: WfAction;
  label: string;
  to: ApprovalStage;
  tone: 'primary' | 'success' | 'warning' | 'danger' | 'default';
  requiresComment?: boolean;
  confirm?: string;
  subject: ApprovalRecord['subject'];
  record: ApprovalRecord['action'];
  makeEvent?: string;
}

/** Human approval state machine. No path to Published skips an explicit approval. */
export function actionsFor(stage: ApprovalStage): WfActionDef[] {
  switch (stage) {
    case 'Draft':
      return [{ action: 'submit', label: 'Submit script for review', to: 'Under Review', tone: 'primary', subject: 'Script', record: 'Submitted', makeEvent: 'script.submitted' }];
    case 'Under Review':
      return [
        { action: 'approve', label: 'Approve script', to: 'Approved', tone: 'success', subject: 'Script', record: 'Approved', makeEvent: 'script.approved', confirm: 'Approve this script for production?' },
        { action: 'requestChanges', label: 'Request changes', to: 'Changes Requested', tone: 'warning', requiresComment: true, subject: 'Script', record: 'Changes Requested', makeEvent: 'script.changes_requested' },
        { action: 'reject', label: 'Reject', to: 'Rejected', tone: 'danger', requiresComment: true, subject: 'Script', record: 'Rejected', confirm: 'Reject this script? The episode will be closed until reopened.' },
      ];
    case 'Changes Requested':
      return [{ action: 'resubmit', label: 'Resubmit for review', to: 'Under Review', tone: 'primary', subject: 'Script', record: 'Submitted', makeEvent: 'script.submitted' }];
    case 'Approved':
      return [{ action: 'startProduction', label: 'Start production', to: 'In Production', tone: 'primary', subject: 'Episode', record: 'Advanced', makeEvent: 'episode.stage_changed' }];
    case 'In Production':
      return [{ action: 'submitFinal', label: 'Submit video for final review', to: 'Final Review', tone: 'primary', subject: 'Video', record: 'Submitted', makeEvent: 'video.final_review' }];
    case 'Final Review':
      return [
        { action: 'approve', label: 'Approve final video', to: 'Ready to Publish', tone: 'success', subject: 'Video', record: 'Approved', makeEvent: 'episode.ready_to_publish', confirm: 'Approve the final cut? It becomes eligible for publishing (still manual).' },
        { action: 'requestChanges', label: 'Request changes', to: 'In Production', tone: 'warning', requiresComment: true, subject: 'Video', record: 'Changes Requested', makeEvent: 'episode.stage_changed' },
        { action: 'reject', label: 'Reject', to: 'Rejected', tone: 'danger', requiresComment: true, subject: 'Video', record: 'Rejected', confirm: 'Reject this episode video?' },
      ];
    case 'Ready to Publish':
      return [{ action: 'publish', label: 'Mark as published', to: 'Published', tone: 'success', subject: 'Publishing', record: 'Published', makeEvent: 'publish.marked_published', confirm: 'Confirm this episode has been posted manually and approved for release. This cannot be undone from here.' }];
    case 'Rejected':
      return [{ action: 'reopen', label: 'Reopen as draft', to: 'Draft', tone: 'default', subject: 'Episode', record: 'Reopened', confirm: 'Reopen this episode as a new draft?' }];
    default:
      return [];
  }
}

/** Side effects on department statuses when a stage changes. */
export function sideEffects(ep: Episode, from: ApprovalStage, a: WfAction): Partial<Episode> {
  switch (a) {
    case 'submit':
    case 'resubmit':
      return { scriptStatus: 'In Review' };
    case 'approve':
      return from === 'Under Review'
        ? { scriptStatus: 'Approved' }
        : { videoStatus: 'Approved', editingStatus: 'Approved', publishingStatus: ep.publishingStatus === 'Not Scheduled' ? 'Draft Prepared' : ep.publishingStatus };
    case 'requestChanges':
      return from === 'Under Review' ? { scriptStatus: 'Changes Requested' } : { editingStatus: 'Changes Requested' };
    case 'startProduction':
      return { storyboardStatus: ep.storyboardStatus === 'Not Started' ? 'In Progress' : ep.storyboardStatus };
    case 'submitFinal':
      return { videoStatus: ep.videoStatus === 'Approved' ? 'Approved' : 'Complete', editingStatus: 'In Review' };
    case 'publish':
      return { publishingStatus: 'Published' };
    case 'reopen':
      return { scriptStatus: 'In Progress' };
    default:
      return {};
  }
}

export const isPublishable = (ep: Episode) => ep.approvalStatus === 'Ready to Publish' || ep.approvalStatus === 'Published';
