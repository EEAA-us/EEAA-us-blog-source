<script setup lang="ts">
import { ref, reactive, watch } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";
import type { FormInstance } from "element-plus";
import { useUserStoreHook } from "@/store/modules/user";
import { initRouter, getTopMenu } from "@/router/utils";
import { useNav } from "@/layout/hooks/useNav";
import { useLayout } from "@/layout/hooks/useLayout";
import { message } from "@/utils/message";
import { loginRules } from "./utils/rule";
import { ReImageVerify } from "@/components/ReImageVerify";
import { useDataThemeChange } from "@/layout/hooks/useDataThemeChange";

defineOptions({ name: "Login" });
const router = useRouter();
const { t } = useI18n();
const { initStorage } = useLayout();
initStorage();
const { themeMode, dataThemeChange } = useDataThemeChange();
dataThemeChange(themeMode.value);
const { title, getLogo } = useNav();
const formRef = ref<FormInstance>();
const loading = ref(false);
const checked = ref(false);
const loginDay = ref(7);
const imgCode = ref("");
const ruleForm = reactive({
  username: "",
  password: "",
  verifyCode: ""
});
watch(imgCode, value => useUserStoreHook().SET_VERIFYCODE(value));
watch(checked, value => useUserStoreHook().SET_ISREMEMBERED(value));
watch(loginDay, value => useUserStoreHook().SET_LOGINDAY(value));
async function onLogin() {
  if (loading.value || !formRef.value) return;
  const valid = await formRef.value.validate().catch(() => false);
  if (!valid) return;
  loading.value = true;
  try {
    await useUserStoreHook().loginByUsername({
      username: ruleForm.username,
      password: ruleForm.password
    });
    await initRouter();
    await router.push(getTopMenu(true).path);
    message(t("login.pureLoginSuccess"), { type: "success" });
  } catch {
    message(t("login.pureLoginFail"), { type: "error" });
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <main class="blog-login">
    <section class="login-story">
      <div class="login-brand">
        <img :src="getLogo()" alt="" /><span
          >{{ title }}<small>记录 · 整理 · 分享</small></span
        >
      </div>
      <div class="login-editorial">
        <span class="blog-eyebrow">属于你的博客工作台</span>
        <h1>把日常的灵感，<br />慢慢写成故事。</h1>
        <p>在这里整理文章、收藏和照片，<br />也看看这些记录走到了谁的面前。</p>
      </div>
      <div class="login-story-footer">
        <span>内容管理</span><span>访问统计</span><span>站点发布</span>
      </div>
    </section>
    <section class="login-entry">
      <div class="login-card">
        <span class="blog-eyebrow">站长入口</span>
        <h2>很高兴，又见到你。</h2>
        <p class="login-note">登录后，继续照顾你的小站。</p>
        <el-form
          ref="formRef"
          :model="ruleForm"
          :rules="loginRules"
          label-position="top"
          size="large"
          @submit.prevent="onLogin"
        >
          <el-form-item
            label="账号"
            prop="username"
            :rules="[
              { required: true, message: '请输入账号', trigger: 'blur' }
            ]"
            ><el-input
              v-model="ruleForm.username"
              autocomplete="username"
              placeholder="站长账号"
          /></el-form-item>
          <el-form-item label="密码" prop="password"
            ><el-input
              v-model="ruleForm.password"
              type="password"
              show-password
              autocomplete="current-password"
              placeholder="请输入密码"
          /></el-form-item>
          <el-form-item label="验证码" prop="verifyCode"
            ><el-input
              v-model="ruleForm.verifyCode"
              placeholder="输入右侧验证码"
              ><template #append
                ><ReImageVerify v-model:code="imgCode" /></template></el-input
          ></el-form-item>
          <div class="login-remember">
            <el-checkbox v-model="checked">记住登录</el-checkbox
            ><select v-model="loginDay" aria-label="记住登录天数">
              <option :value="1">1天</option>
              <option :value="7">7天</option>
              <option :value="30">30天</option>
            </select>
          </div>
          <el-button
            class="login-submit"
            type="primary"
            native-type="submit"
            :loading="loading"
            >进入工作台 <span aria-hidden="true">↗</span></el-button
          >
        </el-form>
        <p class="login-help">仅用于站长管理。账号与密码由本机后台维护。</p>
      </div>
      <p class="login-footnote">{{ title }} · 留一点时间，记录生活。</p>
    </section>
  </main>
</template>
