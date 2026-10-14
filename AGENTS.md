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

- Content/admin data uses the browser Supabase client with RLS (admin writes gated by `has_role`); first signup becomes admin via trigger. Why: simple MVP with DB-enforced security.
- `/tv` is a dependency-free HTML5 `<video>` player (no embeds, no animations). Why: Samsung Tizen 2022 browser compatibility.
- `screens.pairing_code`/`last_heartbeat_at` are reserved for future device pairing; UI must show "дані відсутні" until real heartbeat exists. Ad scheduler is out of MVP scope and should be a separate table/module.
