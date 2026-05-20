I checked the email connection and the backend itself is healthy:

- `notify.bitlance.work` is verified and ready to send.
- The email queue cron job exists and is active.
- The current failure is not DNS or connection-related.
- Recent invoice emails are failing with: `Transactional emails must include an unsubscribe_token`.

Plan:

1. Update invoice email enqueueing
   - Before queueing an invoice email, create or reuse one unsubscribe token for the recipient email.
   - Add that `unsubscribe_token` to the queued email payload so Lovable Email accepts it.

2. Keep invoice sends one-to-one and retry-safe
   - Keep the existing PDF upload + signed download link flow.
   - Keep the current sender as `invoices@notify.bitlance.work` and sender domain as `notify.bitlance.work`.
   - Preserve the existing auth-protected server function.

3. Clean up the stuck failed queue state
   - Remove or dead-letter the currently queued invoice messages that are missing the unsubscribe token, so the queue stops retrying known-bad payloads.
   - Leave historical logs intact for auditing.

4. Verify after the change
   - Query the email send log after another test send to confirm the latest status becomes `sent` instead of `failed` or `dlq`.
   - If it still fails, check the latest provider error directly from the send log.