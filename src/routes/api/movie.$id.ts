import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/movie/$id")({
	server: {
		handlers: {
			GET: async ({ params }) => {
				if (!params.id) {
					return new Response("Invalid request", { status: 400 });
				}

				try {
					const { getTMDB } = await import("~/utils/tmdb");
					const { getRedisOptional, isRedisReady } = await import(
						"~/utils/redis"
					);
					const tmdb = getTMDB();
					const redis = getRedisOptional();
					const canUseCache = Boolean(redis && isRedisReady(redis));
					const id = Number(params.id);

					const cacheKey = `movie:${id}`;

					if (canUseCache && redis) {
						try {
							const cached = await redis.get(cacheKey);

							if (cached) {
								return Response.json(JSON.parse(cached));
							}
						} catch (error) {
							console.warn("Redis read failed for movie details cache.", error);
						}
					}

					const data = await tmdb.movies.details(id);

					if (canUseCache && redis) {
						try {
							await redis.set(cacheKey, JSON.stringify(data), "EX", 604800);
						} catch (error) {
							console.warn(
								"Redis write failed for movie details cache.",
								error,
							);
						}
					}

					return Response.json(data);
				} catch (error) {
					console.error("TMDB Movie Details Error:", error);
					return new Response("Error fetching movie details", { status: 500 });
				}
			},
		},
	},
});
