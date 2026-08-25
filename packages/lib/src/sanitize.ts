import sanitizeHtml from 'sanitize-html';

/**
 * 지문·문항 본문 HTML 정리 (보안조사 L-1).
 *
 * 지문 본문은 응시 화면과 관리자 화면에서 `dangerouslySetInnerHTML`로 그려진다.
 * 쓰기 권한은 관리자뿐이라 외부인이 직접 넣을 수는 없지만, **밖에서 받은 CSV를
 * 일괄 등록**하면 그 안의 `<script>`가 그대로 학생 화면에서 돈다. 원장이 스스로
 * 심는 모양새라 눈치채기도 어렵다.
 *
 * 그래서 화면이 아니라 **저장 시점**에 거른다 — TipTap 에디터 경로와 CSV 경로가
 * 모두 여기를 지나므로 한 곳만 지키면 된다.
 *
 * 허용 목록은 TipTap이 실제로 만들어내는 태그에 맞췄다. 새 서식(예: 표 병합,
 * 각주)을 에디터에 추가하면 여기도 같이 늘려야 한다 — 빠뜨리면 그 서식이
 * 조용히 사라진다.
 */
const ALLOWED_TAGS = [
  'p', 'br', 'span', 'div',
  'strong', 'b', 'em', 'i', 'u', 's', 'sub', 'sup',
  'ul', 'ol', 'li',
  'blockquote', 'pre', 'code',
  'h1', 'h2', 'h3', 'h4',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
  'img', 'hr', 'a',
];

export function sanitizeRichHtml(html: string | null | undefined): string {
  if (!html) return '';
  return sanitizeHtml(html, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: {
      // style은 TipTap이 정렬·색에 쓴다. sanitize-html이 값 문법을 검사하고
      // url()·expression() 류는 걸러낸다.
      '*': ['style', 'class'],
      a: ['href', 'target', 'rel'],
      img: ['src', 'alt', 'width', 'height'],
      td: ['colspan', 'rowspan'],
      th: ['colspan', 'rowspan'],
    },
    // 이미지 경로는 Supabase Storage(https)와 에디터가 잠깐 쓰는 data: 뿐이다.
    allowedSchemes: ['https', 'http', 'mailto'],
    allowedSchemesByTag: { img: ['https', 'http', 'data'] },
    // 링크로 새 창을 열면 opener를 통해 원래 탭을 조작당할 수 있다
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', { rel: 'noopener noreferrer' }),
    },
    // on* 핸들러, <script>, <iframe>은 allowedTags에 없으니 통째로 사라진다.
    disallowedTagsMode: 'discard',
  });
}
