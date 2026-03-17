import type { JobDetails, ScraperResult } from "../types";

const HH_BASE_URL = "https://api.hh.ru";
const USER_AGENT = "JobSync/1.0";

interface HHVacancyShort {
  id: string;
  name: string;
  area: { name: string };
  salary: {
    from: number | null;
    to: number | null;
    currency: string;
    gross: boolean;
  } | null;
  employer: {
    name: string;
  };
  snippet: {
    requirement: string | null;
    responsibility: string | null;
  };
  alternate_url: string;
  published_at: string;
}

interface HHSearchResponse {
  items: HHVacancyShort[];
  found: number;
  pages: number;
  per_page: number;
  page: number;
}

interface HHVacancyFull {
  id: string;
  name: string;
  area: { name: string };
  salary: {
    from: number | null;
    to: number | null;
    currency: string;
    gross: boolean;
  } | null;
  employer: {
    name: string;
  };
  description: string;
  alternate_url: string;
  published_at: string;
}

function htmlToPlainText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/li>/gi, "\n")
    .replace(/<li>/gi, "- ")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function formatSalary(
  salary: HHVacancyShort["salary"],
): string | undefined {
  if (!salary) return undefined;

  const { from, to, currency, gross } = salary;
  if (!from && !to) return undefined;

  const taxLabel = gross ? "до вычета налогов" : "на руки";
  const cur = currency === "RUR" ? "руб." : currency;

  if (from && to) {
    return `${from.toLocaleString("ru-RU")} - ${to.toLocaleString("ru-RU")} ${cur} (${taxLabel})`;
  }
  if (from) {
    return `от ${from.toLocaleString("ru-RU")} ${cur} (${taxLabel})`;
  }
  if (to) {
    return `до ${to.toLocaleString("ru-RU")} ${cur} (${taxLabel})`;
  }
  return undefined;
}

export async function searchHeadHunterJobs(
  keywords: string,
): Promise<ScraperResult<JobDetails[]>> {
  try {
    const url = new URL(`${HH_BASE_URL}/vacancies`);
    url.searchParams.set("text", keywords);
    url.searchParams.set("per_page", "20");
    url.searchParams.set("page", "0");
    url.searchParams.set("order_by", "publication_time");

    const response = await fetch(url.toString(), {
      method: "GET",
      headers: {
        "User-Agent": USER_AGENT,
      },
    });

    if (!response.ok) {
      if (response.status === 429) {
        return {
          success: false,
          error: { type: "rate_limited", retryAfter: 60 },
        };
      }
      if (response.status === 403) {
        return {
          success: false,
          error: {
            type: "blocked",
            reason: "HH.ru API access denied",
          },
        };
      }
      return {
        success: false,
        error: {
          type: "network",
          message: `HH.ru API error: ${response.status} ${response.statusText}`,
        },
      };
    }

    const data: HHSearchResponse = await response.json();

    const jobs: JobDetails[] = [];

    for (const vacancy of data.items) {
      try {
        const fullVacancy = await fetchFullVacancy(vacancy.id);
        if (fullVacancy) {
          jobs.push({
            title: fullVacancy.name,
            company: fullVacancy.employer.name,
            location: fullVacancy.area.name,
            description: htmlToPlainText(fullVacancy.description),
            url: fullVacancy.alternate_url,
            postedDate: fullVacancy.published_at,
            salary: formatSalary(fullVacancy.salary),
          });
        }
      } catch {
        // If fetching full vacancy fails, use search snippet
        const snippetText = [
          vacancy.snippet?.requirement,
          vacancy.snippet?.responsibility,
        ]
          .filter(Boolean)
          .map((s) => htmlToPlainText(s!))
          .join("\n\n");

        jobs.push({
          title: vacancy.name,
          company: vacancy.employer.name,
          location: vacancy.area.name,
          description: snippetText || vacancy.name,
          url: vacancy.alternate_url,
          postedDate: vacancy.published_at,
          salary: formatSalary(vacancy.salary),
        });
      }
    }

    return { success: true, data: jobs };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown error";
    return { success: false, error: { type: "network", message } };
  }
}

async function fetchFullVacancy(
  id: string,
): Promise<HHVacancyFull | null> {
  const response = await fetch(`${HH_BASE_URL}/vacancies/${id}`, {
    method: "GET",
    headers: {
      "User-Agent": USER_AGENT,
    },
  });

  if (!response.ok) return null;

  return response.json();
}
