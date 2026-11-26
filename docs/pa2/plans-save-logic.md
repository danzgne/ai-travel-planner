# Luồng xử lý lưu lịch trình

`POST /v1/plans/{planId}/save` nhận mã lịch trình trong URL và `revision` trong body. Revision là số phiên bản mà người dùng đã xem trước khi bấm Save. Nếu lịch trình hợp lệ, server lưu phiên bản đó và cho các thành viên chuyến đi nhìn thấy lịch trình. [Contract của endpoint](../contract/post-plans-save.md)

## Bắt đầu đọc code ở đâu

| File                                                  | Vai trò                                                                                           |
| ----------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| [app.ts](../../apps/api/src/app.ts)                   | Tạo Express app và gắn router vào `/v1`. Các lỗi trong router được trả dưới dạng problem details. |
| [save.ts](../../apps/api/src/plans/save.ts)           | Điều phối toàn bộ request, từ xác thực đến lưu.                                                   |
| [cost.ts](../../apps/api/src/plans/cost.ts)           | Tra giá menu, tính tiền từng người và tổng chuyến đi.                                             |
| [validator.ts](../../apps/api/src/plans/validator.ts) | Duyệt lịch trình và gom các vi phạm.                                                              |
| [store.ts](../../apps/api/src/plans/store.ts)         | Giữ plan hiện tại, bản sao response đã lưu và lock theo plan.                                     |
| [problems.ts](../../apps/api/src/problems.ts)         | Ánh xạ mã lỗi sang HTTP status và định dạng `application/problem+json`.                           |

`createApp(deps)` nhận bộ xác thực token, store, nguồn dữ liệu địa điểm và nguồn dự báo. Bộ test truyền dữ liệu giả vào các vị trí này để gọi chính route Express bằng Supertest. Khi chạy server mặc định, bộ xác thực hiện từ chối token cho đến khi được nối với hệ thống đăng nhập.

## Một request Save đi qua những gì

1. **Xác thực và kiểm tra quyền.** Server xác thực bearer token trước. Token thiếu hoặc sai nhận `401 unauthenticated`. ID sai, plan không tồn tại hoặc người gọi không được nhìn thấy plan đều nhận cùng body `404 not-found`. Thành viên khác tác giả chỉ nhìn thấy plan sau lần lưu đầu tiên. Khi đó, nếu họ gọi Save, họ nhận `403 not-plan-author`.
2. **Đọc và kiểm tra body.** Server chỉ đọc body dạng JSON sau khi quyền đã hợp lệ. JSON hỏng nhận `400 invalid-json`. Body sai cấu trúc nhận `400 validation` với pointer `""`. Nếu `revision` thiếu hoặc không phải số nguyên dương, pointer là `/revision`. Vì thứ tự này, request thiếu token dù gửi JSON hỏng vẫn nhận `401`.
3. **Tìm response đã lưu.** Store tra theo cặp `(planId, revision)`. Nếu đã có, server trả lại body cũ và thêm header `Idempotent-Replayed: true`. Thời điểm lưu, giá và tổng tiền trong body cũ được giữ nguyên.
4. **Giữ lock cho plan và so sánh revision.** Chỉ một request ở một thời điểm được chạy phần lưu cho cùng một plan. Nếu đang có request giữ lock, request sau nhận `409 save-in-progress`. Nếu lấy được lock nhưng revision không khớp, server trả `409 revision-conflict` kèm `currentRevision`.
5. **Đọc dữ liệu, tính giá và kiểm tra lịch trình.** Server đọc địa điểm và dự báo cùng lúc. Nếu không đọc được một trong hai, server trả `503 validator-unavailable` kèm `Retry-After: 30`. Nếu dữ liệu đọc được nhưng plan vi phạm quy tắc, server trả `422 plan-invalid` và danh sách `violations`.
6. **Lưu và trả `200`.** Server kiểm tra lại revision sau khi chờ dữ liệu để tránh ghi đè lên một bản chỉnh sửa mới. Store cập nhật plan và ghi bản sao response trong cùng một thao tác đồng bộ. Response có `status: "saved"`, `savedRevision`, `savedAt` theo UTC, giá và chi tiêu. Khối `finally` luôn nhả lock sau khi xử lý xong.

## Tiền và lý do một plan bị từ chối

Ví dụ người A gọi một món giá 45.000 đồng và người B gọi hai món cùng giá. `pricePlan` tra giá trong menu, nhân với số lượng và cộng theo người. A tiêu 45.000 đồng, B tiêu 90.000 đồng và cả nhóm tiêu 135.000 đồng. Nếu A đặt cap 200.000 đồng còn B đặt cap 150.000 đồng, giới hạn áp dụng cho mỗi người là 150.000 đồng. Nếu cả nhóm chưa đặt cap, giới hạn từng người là `null`. Với chuyến đi cá nhân, giới hạn bằng ngân sách chuyến đi.

`validatePlan` đọc plan gốc để tìm nơi sai, kể cả món hoặc người trả tiền mà bước tính giá đã bỏ qua. Hàm duyệt các ngày và điểm dừng theo thứ tự trong plan, rồi kiểm tra chi tiêu. Ví dụ pointer `/days/0/stops/1` trỏ tới điểm dừng thứ hai của ngày đầu tiên. Mỗi lỗi có `code`, `pointer` và `detail`. Nếu có lỗi, plan vẫn giữ trạng thái trước request và store không ghi response replay.

## Theo dõi ba tình huống trong test

| Tình huống                                             | Điều xảy ra                                                                                                                               |
| ------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Lưu plan 42 ở revision 4, rồi gửi lại cùng request     | Lần đầu lưu và trả `200`. Lần sau trả đúng body của lần đầu, kể cả khi plan hiện đã lên revision 5.                                       |
| Lần lưu đầu đang chờ dự báo, lần hai gửi cùng revision | Lần hai nhận `409 save-in-progress`. Nếu lần đầu đã lưu xong khi lần hai đến, lần hai nhận replay `200`.                                  |
| Gửi revision 5 khi plan còn ở revision 4               | Server trả `409` kèm `currentRevision: 4`. Khi plan lên revision 5, cùng request đó có thể lưu bình thường vì lỗi trước không được cache. |

Để đối chiếu, đọc [bộ contract tests](../../apps/api/test/contract/plans-save.test.ts). Xem [quy trình commit và bằng chứng CI](plans-save-workflow.md) để theo dõi Step 1 và Step 2 trên GitHub.
