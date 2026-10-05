import { ListingSkeleton } from '@/components/listing/listing-skeleton';

export default function SearchLoading() {
  return <ListingSkeleton crumbs={false} label="Searching…" />;
}
