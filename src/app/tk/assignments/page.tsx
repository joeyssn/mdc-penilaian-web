import SdAssignments from '@/components/SdAssignments';

// TK assigns its teachers in the same module as SD (principal / admin), limited to TK teachers.
export default function TKAssignmentsPage() {
  return <SdAssignments school="TK" />;
}
