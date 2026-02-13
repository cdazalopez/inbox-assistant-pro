
-- Create labels table for user-defined custom labels
CREATE TABLE public.labels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  name TEXT NOT NULL,
  color TEXT NOT NULL DEFAULT '#6366f1',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create junction table for email-label assignments
CREATE TABLE public.email_labels (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  email_id TEXT NOT NULL,
  label_id UUID NOT NULL REFERENCES public.labels(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(email_id, label_id)
);

-- Enable RLS
ALTER TABLE public.labels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_labels ENABLE ROW LEVEL SECURITY;

-- Labels policies
CREATE POLICY "Users can view their own labels"
  ON public.labels FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own labels"
  ON public.labels FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own labels"
  ON public.labels FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own labels"
  ON public.labels FOR DELETE
  USING (auth.uid() = user_id);

-- Email labels policies
CREATE POLICY "Users can view their own email labels"
  ON public.email_labels FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can assign labels to emails"
  ON public.email_labels FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove labels from emails"
  ON public.email_labels FOR DELETE
  USING (auth.uid() = user_id);

-- Indexes for performance
CREATE INDEX idx_labels_user_id ON public.labels(user_id);
CREATE INDEX idx_email_labels_user_id ON public.email_labels(user_id);
CREATE INDEX idx_email_labels_email_id ON public.email_labels(email_id);
CREATE INDEX idx_email_labels_label_id ON public.email_labels(label_id);
