CREATE INDEX "otp_codes_phone_idx" ON "otp_codes" USING btree ("phone");--> statement-breakpoint
CREATE INDEX "otp_requests_phone_created_at_idx" ON "otp_requests" USING btree ("phone","created_at");--> statement-breakpoint
CREATE INDEX "otp_requests_ip_created_at_idx" ON "otp_requests" USING btree ("ip","created_at");
