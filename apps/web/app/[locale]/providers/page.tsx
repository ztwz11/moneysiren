import {
  PageHeader,
  ProviderCatalogView,
} from "../../../components/OperationsViews";
import { getMessages, isLocale, type Locale } from "../../../lib/i18n";
import { providerCatalog, type ProviderCatalogStatus, type ProviderCategory } from "../../../lib/provider-catalog";

interface PageProps {
  params: Promise<{
    locale: string;
  }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}

export const dynamic = "force-dynamic";

export default async function ProvidersPage({ params, searchParams }: PageProps) {
  const locale = await readLocale(params);
  const messages = getMessages(locale);
  const filters = parseFilters((await searchParams) ?? {});
  const filteredProviders = providerCatalog.filter((provider) => {
    const queryMatch = filters.q.length === 0 || provider.name.toLowerCase().includes(filters.q.toLowerCase());
    const categoryMatch = filters.category === "" || provider.category === filters.category;
    const statusMatch = filters.status === "" || provider.status === filters.status;

    return queryMatch && categoryMatch && statusMatch;
  });

  return (
    <>
      <PageHeader title={messages.catalog.title} subtitle={messages.catalog.subtitle} />
      <form className="panel catalog-filter-panel" method="get">
        <div className="catalog-filter-grid">
          <label className="catalog-filter-field">
            <span className="metric-label">{messages.catalog.search}</span>
            <input className="catalog-filter-control" name="q" defaultValue={filters.q} />
          </label>
          <label className="catalog-filter-field">
            <span className="metric-label">{messages.catalog.category}</span>
            <select className="catalog-filter-control" name="category" defaultValue={filters.category}>
              <option value="">{messages.catalog.all}</option>
              <option value="Cloud">Cloud</option>
              <option value="AI">AI</option>
              <option value="Database">Database</option>
              <option value="Hosting">Hosting</option>
              <option value="Observability">Observability</option>
            </select>
          </label>
          <label className="catalog-filter-field">
            <span className="metric-label">{messages.catalog.status}</span>
            <select className="catalog-filter-control" name="status" defaultValue={filters.status}>
              <option value="">{messages.catalog.all}</option>
              <option value="available">{messages.catalog.available}</option>
              <option value="planned">{messages.catalog.planned}</option>
              <option value="research">{messages.catalog.research}</option>
            </select>
          </label>
          <button className="primary-button catalog-filter-button" type="submit">
            {messages.catalog.search}
          </button>
        </div>
      </form>
      <ProviderCatalogView providers={filteredProviders} locale={locale} messages={messages} />
    </>
  );
}

async function readLocale(params: PageProps["params"]): Promise<Locale> {
  const { locale } = await params;

  return isLocale(locale) ? locale : "en";
}

function parseFilters(searchParams: Record<string, string | string[] | undefined>): {
  q: string;
  category: ProviderCategory | "";
  status: ProviderCatalogStatus | "";
} {
  return {
    q: firstValue(searchParams.q),
    category: parseCategory(firstValue(searchParams.category)),
    status: parseStatus(firstValue(searchParams.status)),
  };
}

function firstValue(value: string | string[] | undefined): string {
  if (Array.isArray(value)) {
    return value[0] ?? "";
  }

  return value ?? "";
}

function parseCategory(value: string): ProviderCategory | "" {
  if (value === "Cloud" || value === "AI" || value === "Database" || value === "Hosting" || value === "Observability") {
    return value;
  }

  return "";
}

function parseStatus(value: string): ProviderCatalogStatus | "" {
  if (value === "available" || value === "planned" || value === "research") {
    return value;
  }

  return "";
}
