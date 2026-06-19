<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Push 전 필수 — `pnpm build` 통과 확인

**dev 서버(Turbopack)는 type check를 안 한다.** `pnpm dev`에서 멀쩡해도 production build에서 TypeScript 에러로 터진다. push/배포 전에 반드시 영향 받는 앱(`apps/web` 또는 `apps/admin`)에서 `pnpm build`를 돌려서 빌드와 타입 체크가 통과하는 걸 확인한 뒤에 push할 것.

- 영향 범위가 `packages/*` 또는 공통 types면 두 앱 모두 빌드.
- 빌드 실패하면 에러 메시지대로 수정 → 다시 `pnpm build` → 통과될 때까지 push 보류.
- `curl 200` 응답이나 dev 콘솔의 "Compiled" 메시지를 검증으로 삼지 말 것.

자주 터지는 패턴:
- `.map(...)` 결과에 `null`이 섞이고 `.filter(narrow)` 좁히기가 안 먹을 때 → `flatMap`으로 우회
- 컴포넌트에 새 prop 추가했는데 다른 호출처에서 안 넘긴 경우
- supabase/db types 변경 후 caller가 옛 컬럼 참조
