import { serializeJsonLd, type JsonLdObject } from './json-ld';

/** Structured data for search engines. The payload is escaped by `serializeJsonLd`. */
export function JsonLd({ data }: { data: JsonLdObject | readonly JsonLdObject[] }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{ __html: serializeJsonLd(data) }}
    />
  );
}
