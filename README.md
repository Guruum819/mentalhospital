# 교환독서

친구들끼리 책을 돌려 읽으며, 누가 읽었는지와 누가 지금 읽고 있는지를 한 화면에서 체크하는 서재입니다. 계정이 없고, 링크를 받은 사람은 누구나 고칠 수 있습니다.

처음에는 친구가 없습니다. 이름, 생일, 색, 프로필 사진으로 가입하면 그 사람이 읽는 사람 칸이 됩니다. 다른 폰에서는 같은 이름과 생일로 로그인합니다. 모임은 10명까지이고, 프로필을 지우면 자리와 색이 다시 비습니다.

## 화면에서 하는 일

- 친구 이름을 누르면 읽음. 다시 누르면 해제됩니다. 읽은 칸은 그 친구의 색으로 채워집니다.
- 카드 아래 **읽는 중 표시**에서 이름을 고르면 `지금 읽는 중`이 붙습니다. **해제**는 한 번입니다. 그 친구를 읽음으로 체크하면 읽는 중은 자동으로 빠집니다.
- **책 추가**에서 제목을 검색하면 표지와 저자가 채워집니다. 검색이 안 되면 직접 입력합니다.
- 위쪽 친구 이름을 누르면 이름과 색을 바꿉니다. 색은 서로 겹치지 않고, 모두가 같은 색을 봅니다.

제목은 카드 맨 위에 크게 보입니다.

## 1. 내 컴퓨터에서 먼저 보기

Node.js 22가 필요합니다.

```bash
npm install
npm run dev
```

브라우저에서 `http://127.0.0.1:43123` 을 엽니다. Firebase 설정이 없으면 **이 브라우저 데모**입니다. 같은 브라우저의 탭끼리는 바로 맞춰지고, 다른 폰과는 맞춰지지 않습니다.

## 2. Firebase 한 번만 연결하기

여러 폰에서 같은 서재를 보려면 무료 Realtime Database가 필요합니다. Google 계정만 있으면 되고, 카드 등록은 필요 없습니다.

1. [Firebase 콘솔](https://console.firebase.google.com)에서 **프로젝트 추가**. 이름은 예: `exchange-reading`. Google 애널리틱스는 끕니다.
2. **빌드 → Realtime Database → 데이터베이스 만들기**.
3. 위치는 `asia-southeast1`(싱가포르)를 고릅니다. Realtime Database에는 서울 리전이 없습니다.
4. 보안 규칙은 **잠금 모드**로 시작한 뒤, **규칙** 탭에 `firebase/database.rules.json` 내용 전체를 붙여넣고 **게시**합니다. 테스트 모드 규칙은 30일 뒤에 잠기므로 쓰지 마세요.
5. 톱니바퀴 **프로젝트 설정 → 일반 → 내 앱 → 웹(`</>`)** 을 누릅니다. 앱 닉네임은 `교환독서`, Firebase 호스팅은 체크하지 않고 **앱 등록**.
6. 나오는 `firebaseConfig`에서 아래 값을 복사합니다. `databaseURL`이 없으면 데이터베이스 화면 위쪽 주소(`https://….firebasedatabase.app` 또는 `….firebaseio.com`)를 그대로 씁니다.

| GitHub Secret 이름 | firebaseConfig 항목 |
| --- | --- |
| `VITE_FIREBASE_API_KEY` | `apiKey` |
| `VITE_FIREBASE_AUTH_DOMAIN` | `authDomain` |
| `VITE_FIREBASE_DATABASE_URL` | `databaseURL` |
| `VITE_FIREBASE_PROJECT_ID` | `projectId` |
| `VITE_FIREBASE_APP_ID` | `appId` |

값은 따옴표 없이 넣습니다. 이 주소는 페이지를 열 수 있는 사람이면 JS에서 볼 수 있습니다. 비밀 일기나 비밀번호를 적지 말고, 링크는 친구에게만 보내세요. 메뉴의 **그룹 암호**는 화면을 가리는 가벼운 잠금입니다.

로컬에서 바로 Firebase에 붙이려면 `.env.example`을 `.env.local`로 복사해 같은 값을 채운 뒤 `npm run dev` 합니다.

## 3. GitHub에 올리고 Pages로 열기

1. GitHub에서 새 저장소를 만듭니다. 코드는 비공개여도 되고, 배포된 페이지 주소는 공개됩니다.
2. 이 프로젝트를 푸시합니다.

```bash
git remote add github https://github.com/<아이디>/<저장소>.git
git push -u github main
```

이미 `origin`이 GitHub라면 `git push -u origin main` 이면 됩니다.

3. 저장소 **Settings → Secrets and variables → Actions → New repository secret** 에 위 표의 시크릿을 넣습니다. 책 검색 키는 없어도 됩니다.
4. **Settings → Pages → Build and deployment → Source** 를 **GitHub Actions** 로 바꿉니다.
5. **Actions** 탭에서 **Deploy to GitHub Pages** 가 끝났는지 확인합니다. 시크릿을 워크플로보다 나중에 넣었다면 **Run workflow** 로 한 번 더 실행합니다.
6. 워크플로에 나온 주소(보통 `https://<아이디>.github.io/<저장소>/`)를 친구에게 보냅니다.

시크릿 없이 배포되면 데모 모드라 휴대폰끼리 내용이 다릅니다. 시크릿을 넣고 워크플로를 다시 실행하면 모두가 같은 서재를 봅니다. 화면의 **실시간** 표시가 그 상태입니다.

## 4. 책 검색 (선택)

키 없이도 제목 검색이 됩니다. 순서는 다음과 같습니다.

1. 카카오 REST 키가 있으면 카카오 책 검색을 먼저 씁니다. 한국어 책이 가장 잘 나옵니다.
2. 없으면 [Google Books](https://www.googleapis.com/books/v1/volumes) 를 키 없이 부릅니다. 브라우저에서 바로 호출되고, 별도 서버가 필요 없습니다. 공용 한도에 걸리면 안내가 뜹니다.
3. 그것도 비면 Open Library 결과를 보여 줍니다.
4. 언제나 **검색 없이 직접 입력**으로 제목과 저자를 넣을 수 있습니다. 표지가 없어도 책이 올라갑니다.

카카오 키를 쓰려면:

1. [Kakao Developers](https://developers.kakao.com) 에 로그인하고 **내 애플리케이션 → 애플리케이션 추가**.
2. **앱 키**의 **REST API 키**를 복사합니다.
3. GitHub Secret `VITE_KAKAO_REST_API_KEY` 에 넣습니다. 로컬은 `.env.local` 에 같은 이름으로 넣습니다.
4. 워크플로를 다시 실행합니다.

이 키는 배포된 페이지의 JS에 포함됩니다. 책 검색 쿼터만 쓰고, 저장소는 비공개를 권합니다. 카카오가 도메인을 요구하면 앱의 **플랫폼 → Web** 에 Pages 주소를 추가합니다.

Google Books 키를 따로 만들려면 Google Cloud에서 Books API를 켜고 API 키를 만든 뒤 `VITE_GOOGLE_BOOKS_API_KEY` 에 넣습니다. 없어도 동작합니다.

## 문제 해결

- 배포했는데 **이 브라우저** 라고 나오면 시크릿 이름이 정확한지 확인하고 워크플로를 다시 실행합니다.
- `permission denied` 가 나오면 데이터베이스 규칙을 위 JSON으로 바꿨는지 확인합니다.
- 검색이 한도에 걸리면 직접 입력하거나 카카오 키를 넣습니다.
