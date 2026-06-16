"use client";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StudentSignupForm } from "./student-signup-form";
import { ParentSignupForm } from "./parent-signup-form";

export function SignupTabs() {
  return (
    <Tabs defaultValue="student" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="student">학생 가입</TabsTrigger>
        <TabsTrigger value="parent">학부모 가입</TabsTrigger>
      </TabsList>
      <TabsContent value="student" className="mt-4">
        <StudentSignupForm />
      </TabsContent>
      <TabsContent value="parent" className="mt-4">
        <ParentSignupForm />
      </TabsContent>
    </Tabs>
  );
}
