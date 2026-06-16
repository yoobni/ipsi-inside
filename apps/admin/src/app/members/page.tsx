import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function MembersPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold">회원 관리</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          승인된 학생/학부모 계정 전체를 관리할 수 있어요.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>준비 중</CardTitle>
          <CardDescription>
            전체 회원 리스트, 검색, 권한 변경, 계정 정지 등의 기능은 2차 작업에서 추가할 예정이에요.
          </CardDescription>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground">
          현재는 <span className="font-medium text-foreground">가입 승인</span> 메뉴에서 신규 가입자만 처리할 수 있어요.
        </CardContent>
      </Card>
    </div>
  );
}
