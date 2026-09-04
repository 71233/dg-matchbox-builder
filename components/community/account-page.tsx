'use client';

import { useEffect, useState } from 'react';
import { GitBranch, Heart, LogIn, Mail, UploadCloud } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { getSupabase, isSupabaseConfigured } from '@/lib/supabase/client';

export function AccountPage() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [userEmail, setUserEmail] = useState<string>();
  useEffect(() => {
    const client = getSupabase();
    void client?.auth
      .getUser()
      .then(({ data }) => setUserEmail(data.user?.email))
      .catch(() => undefined);
    return client?.auth.onAuthStateChange((_, session) =>
      setUserEmail(session?.user.email),
    ).data.subscription.unsubscribe;
  }, []);
  const magicLink = async () => {
    const client = getSupabase();
    if (!client)
      return setMessage(
        'Add the public Supabase configuration to enable sign-in.',
      );
    const { error } = await client.auth.signInWithOtp({
      email,
      options: {
        emailRedirectTo:
          window.location.origin + window.location.pathname + '#/account',
      },
    });
    setMessage(error?.message ?? 'Check your email for the sign-in link.');
  };
  const github = async () => {
    const client = getSupabase();
    if (!client) {
      setMessage('Supabase configuration is required.');
      return;
    }
    await client.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo:
          window.location.origin + window.location.pathname + '#/account',
      },
    });
  };
  if (userEmail)
    return (
      <section className="min-h-[calc(100vh-56px)] bg-[#111316] p-8">
        <div className="mx-auto max-w-3xl">
          <p className="text-xs uppercase tracking-[0.16em] text-[#ff8b3d]">
            Creator account
          </p>
          <h1 className="mt-2 text-3xl font-semibold">{userEmail}</h1>
          <div className="mt-8 grid gap-4 md:grid-cols-2">
            <Panel
              icon={<UploadCloud />}
              title="Submissions"
              body="Submitted and published projects appear here."
            />
            <Panel
              icon={<Heart />}
              title="Favorites"
              body="Quickly reopen saved community projects."
            />
          </div>
          <Button
            variant="outline"
            className="mt-6"
            onClick={() => {
              void getSupabase()?.auth.signOut();
            }}
          >
            Sign out
          </Button>
        </div>
      </section>
    );
  return (
    <section className="grid min-h-[calc(100vh-56px)] place-items-center bg-[#111316] p-5">
      <div className="w-full max-w-md rounded-2xl border border-[#30333a] bg-[#181a1f] p-6 shadow-2xl">
        <div className="grid size-11 place-items-center rounded-lg bg-[#2c2119] text-[#ff8b3d]">
          <LogIn />
        </div>
        <h1 className="mt-5 text-2xl font-semibold">Publish your work</h1>
        <p className="mt-2 text-sm leading-relaxed text-[#9196a0]">
          Building and exporting need no account. Sign in only to submit,
          favorite and manage your profile.
        </p>
        <div className="mt-6 flex gap-2">
          <Input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="you@example.com"
            className="h-10 border-[#363a42] bg-[#101215]"
          />
          <Button onClick={magicLink} disabled={!email}>
            <Mail /> Send
          </Button>
        </div>
        <div className="my-4 flex items-center gap-3 text-[10px] uppercase tracking-widest text-[#606670]">
          <span className="h-px flex-1 bg-[#30343b]" />
          or
          <span className="h-px flex-1 bg-[#30343b]" />
        </div>
        <Button
          variant="outline"
          className="h-10 w-full border-[#383c44] bg-[#202329]"
          onClick={github}
        >
          <GitBranch /> GitHub
        </Button>
        {message && (
          <p className="mt-4 rounded-lg bg-[#22252b] p-3 text-xs text-[#c1c4ca]">
            {message}
          </p>
        )}
        {!isSupabaseConfigured() && (
          <p className="mt-4 text-[10px] leading-relaxed text-[#737984]">
            Demo mode: add VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY
            to connect the community backend.
          </p>
        )}
      </div>
    </section>
  );
}

function Panel({
  icon,
  title,
  body,
}: {
  icon: React.ReactNode;
  title: string;
  body: string;
}) {
  return (
    <div className="rounded-xl border border-[#30333a] bg-[#181a1f] p-5">
      <div className="text-[#ff8b3d]">{icon}</div>
      <h2 className="mt-4 font-semibold">{title}</h2>
      <p className="mt-2 text-xs leading-relaxed text-[#858b95]">{body}</p>
    </div>
  );
}
