import { createFileRoute } from "@tanstack/react-router";
import type Redis from "ioredis";
import type {
	AggregateCast,
	AggregateCredits,
	Cast,
	Credits,
	TMDB,
} from "tmdb-ts";

import type { NormalizedCast } from "~/types";

const DEFAULT_OFFSET = 0;
const DEFAULT_LIMIT = 500; // Number of cast members to return per request
const CHUNK_SIZE = 20; // Number of concurrent requests
const CHUNK_DELAY_MS = 100; // Delay between chunks in milliseconds

async function getPersonDetailsCached(
	personId: number,
	redis: Redis,
	tmdb: TMDB,
) {
	const cacheKey = `person:${personId}`;
	const cached = await redis.get(cacheKey);
	if (cached) {
		try {
			return JSON.parse(cached);
		} catch (err) {
			console.warn(`Failed to parse cached person ${personId}`, err);
		}
	}

	// Not in cache, fetch from TMDB
	const person = await getPersonDetails(personId, tmdb);
	if (person) {
		await redis.set(cacheKey, JSON.stringify(person), "EX", 86400); // Cache for 1 day
	}

	return person;
}

async function getPersonDetails(personId: number, tmdb: TMDB) {
	try {
		return await tmdb.people.details(personId);
	} catch (error) {
		console.error("TMDB Person Details Error:", error);
		return null;
	}
}

async function chunkedFetch<T, R>(
	items: T[],
	fn: (item: T) => Promise<R>,
	chunkSize = CHUNK_SIZE,
	delayMs = CHUNK_DELAY_MS,
): Promise<R[]> {
	const results: R[] = [];

	for (let i = 0; i < items.length; i += chunkSize) {
		const chunk = items.slice(i, i + chunkSize);
		const result = await Promise.all(chunk.map(fn));
		results.push(...result);

		if (i + chunkSize < items.length) {
			await new Promise((resolve) => setTimeout(resolve, delayMs));
		}
	}

	return results;
}

function getCharacters(member: Cast | AggregateCast) {
	if ("character" in member) {
		return member.character ? [member.character] : [];
	} else if ("roles" in member) {
		return member.roles.map((r) => r.character);
	}

	return [];
}

export const Route = createFileRoute("/api/credits")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				const {
					id,
					type,
					offset = DEFAULT_OFFSET,
					limit = DEFAULT_LIMIT,
					group = true,
				} = await request.json();

				if (!id || !type || (type !== "movie" && type !== "tv")) {
					return new Response("Invalid request", { status: 400 });
				}

				try {
					// Dynamic imports to keep server-side only
					const { getTMDB } = await import("~/utils/tmdb");
					const { getRedis } = await import("~/utils/redis");
					const tmdb = getTMDB();
					const redis = getRedis();

					// Check if full credits are cached (for this offset/limit combination)
					const creditsCacheKey = `credits:${type}:${id}:${offset}:${limit}`;
					const cachedCredits = await redis.get(creditsCacheKey);

					if (cachedCredits) {
						return Response.json(JSON.parse(cachedCredits));
					}

					let rawCast: Cast[] | AggregateCast[] = [];

					if (type === "movie") {
						const data: Credits = await tmdb.movies.credits(id);
						rawCast = data.cast;
					} else if (type === "tv") {
						const data: AggregateCredits =
							await tmdb.tvShows.aggregateCredits(id);
						rawCast = data.cast;
					}

					// Include anyone with an actual cast character credit, regardless of
					// their primary known_for_department (e.g. directors with acting roles).
					const actingCast = rawCast
						.filter((member) => getCharacters(member).length > 0)
						.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

					const total = actingCast.length;
					const paginatedCast = actingCast.slice(offset, offset + limit);

					if (total === 0) {
						const response = {
							id,
							type,
							cast: [],
							total: 0,
						};

						await redis.set(
							creditsCacheKey,
							JSON.stringify(response),
							"EX",
							86400,
						);

						return Response.json(response);
					}

					// Fetch detailed info with caching - use mget for batch Redis operations
					const cacheKeys = paginatedCast.map(
						(member) => `person:${member.id}`,
					);

					// Batch fetch all cache keys at once
					const cachedValues =
						cacheKeys.length > 0 ? await redis.mget(...cacheKeys) : [];

					const detailedCast: NormalizedCast[] = [];
					const toFetch: (Cast | AggregateCast)[] = [];

					// Process cached results
					paginatedCast.forEach((member, index) => {
						const cachedPerson = cachedValues[index];

						if (cachedPerson) {
							try {
								const person = JSON.parse(cachedPerson);
								detailedCast.push({
									id: member.id,
									name: member.name,
									original_name: member.original_name,
									gender: member.gender,
									profile_path: member.profile_path ?? null,
									characters: getCharacters(member),
									order: member.order,
									birthday: person?.birthday ?? null,
									deathday: person?.deathday ?? null,
								});
							} catch {
								toFetch.push(member);
							}
						} else {
							toFetch.push(member);
						}
					});

					// Fetch remaining from TMDB
					const fetched: NormalizedCast[] = await chunkedFetch(
						toFetch,
						async (member) => {
							const person = await getPersonDetailsCached(
								member.id,
								redis,
								tmdb,
							);

							return {
								id: member.id,
								name: member.name,
								original_name: member.original_name,
								gender: member.gender,
								profile_path: member.profile_path ?? null,
								characters: getCharacters(member),
								order: member.order,
								birthday: person?.birthday ?? null,
								deathday: person?.deathday ?? null,
							};
						},
					);

					// Combine cached and fetched
					detailedCast.push(...fetched);

					if (group) {
						// Group by status: Alive, Deceased, Unknown
						detailedCast.sort((a, b) => {
							const getStatus = (member: NormalizedCast) => {
								if (member.deathday) return 2; // Deceased
								if (member.birthday) return 0; // Alive
								return 1; // Unknown
							};

							const statusA = getStatus(a);
							const statusB = getStatus(b);

							if (statusA !== statusB) {
								return statusA - statusB;
							}

							return (a.order ?? 0) - (b.order ?? 0);
						});
					}

					const response = {
						id,
						type,
						cast: detailedCast,
						total,
					};

					// Cache the full credits response for 1 day
					await redis.set(
						creditsCacheKey,
						JSON.stringify(response),
						"EX",
						86400,
					);

					return Response.json(response);
				} catch (error) {
					console.error("TMDB Credits Error:", error);

					return new Response("Failed to fetch credits", {
						status: 500,
					});
				}
			},
		},
	},
});
