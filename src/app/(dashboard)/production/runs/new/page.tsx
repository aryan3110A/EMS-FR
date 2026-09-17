import { redirect } from 'next/navigation';

export default function NewProductionRunPage() {
  redirect('/production/runs?new=1');
}
