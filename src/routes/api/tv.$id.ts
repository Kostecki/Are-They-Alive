import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/tv/$id")({
	server: {
		handlers: {
			GET: async ({ params }) => {
				if (!params.id) {
					return new Response("Invalid request", { status: 400 });
				}

				try {
					const { getTMDB } = await import("~/utils/tmdb");
					const { getRedisOptional } = await import("~/utils/redis");
					const tmdb = getTMDB();
					const redis = getRedisOptional();
					const id = Number(params.id);

					const cacheKey = `tv:${id}`;

					if (redis) {
						try {
							const cached = await redis.get(cacheKey);

							if (cached) {
								return Response.json(JSON.parse(cached));
							}
						} catch (error) {
							console.warn("Redis read failed for TV details cache.", error);
						}
					}

					const [details, externalIds] = await Promise.all([
						tmdb.tvShows.details(id),
						tmdb.tvShows.externalIds(id),
					]);

					const dataWithImdb = {
						...details,
						imdb_id: externalIds.imdb_id || null,
					};

					if (redis) {
						try {
							await redis.set(
								cacheKey,
								JSON.stringify(dataWithImdb),
								"EX",
								604800,
							);
						} catch (error) {
							console.warn("Redis write failed for TV details cache.", error);
						}
					}

					return Response.json(dataWithImdb);
				} catch (error) {
					console.error("TMDB TV Show Details Error:", error);
					return new Response("Error fetching tv show details", {
						status: 500,
					});
				}
			},
		},
	},
});
