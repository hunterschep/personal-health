import { notFound, redirect } from "next/navigation";

import { AuthenticationError, AuthorizationError, NotFoundError } from "@/domain/shared/errors";

export async function withPageAuthorization<T>(operation: () => Promise<T>): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    if (error instanceof NotFoundError || error instanceof AuthorizationError) notFound();
    if (error instanceof AuthenticationError) redirect("/sign-in?reason=session-required");
    throw error;
  }
}
