import { Button } from "@/components/ui/button";

export function InviteAuthActions({ returnTo }: { returnTo: string }) {
  return (
    <form action="/api/auth/invite-return" method="post" className="flex flex-wrap gap-2">
      <input type="hidden" name="returnTo" value={returnTo} />
      <Button type="submit" name="destination" value="sign-in">
        Sign in
      </Button>
      <Button type="submit" name="destination" value="register" variant="secondary">
        Create account
      </Button>
    </form>
  );
}

export function InviteSwitchAccount({ returnTo }: { returnTo: string }) {
  return (
    <form action="/api/auth/invite-return" method="post">
      <input type="hidden" name="returnTo" value={returnTo} />
      <Button type="submit" name="destination" value="switch-account" variant="secondary">
        Use another account
      </Button>
    </form>
  );
}
