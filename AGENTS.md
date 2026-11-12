<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->
- Public API routes that perform privileged database or storage operations must authenticate callers in the handler and dynamically load the admin client there; never open anon RLS for webhook or upload writes. WhatsApp webhook lives at src/routes/api/public/whatsapp/webhook.ts and verifies the token plus X-Hub-Signature-256 HMAC.
