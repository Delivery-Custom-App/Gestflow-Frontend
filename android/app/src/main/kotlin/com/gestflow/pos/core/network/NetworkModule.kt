package com.gestflow.pos.core.network

import com.gestflow.pos.BuildConfig
import com.gestflow.pos.data.remote.AuthApi
import com.gestflow.pos.data.remote.CajasApi
import com.gestflow.pos.data.remote.DashboardApi
import com.gestflow.pos.data.remote.LocalsApi
import com.gestflow.pos.data.remote.MesasApi
import com.gestflow.pos.data.remote.OrdersApi
import com.gestflow.pos.data.remote.WebhooksApi
import dagger.Module
import dagger.Provides
import dagger.hilt.InstallIn
import dagger.hilt.components.SingletonComponent
import kotlinx.serialization.json.Json
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.kotlinx.serialization.asConverterFactory
import javax.inject.Singleton

/**
 * DI de red minimo (Paso 2 del plan). El interceptor de auth (Bearer + refresh
 * automatico en 401) se agrega en un paso posterior, cuando haya endpoints
 * autenticados reales que lo necesiten (mesas, orders, etc.).
 */
@Module
@InstallIn(SingletonComponent::class)
object NetworkModule {

    @Provides
    @Singleton
    fun provideJson(): Json = Json {
        ignoreUnknownKeys = true
        isLenient = true
        // Sin esto, kotlinx.serialization omite del JSON los campos con valor
        // default (ej. payment_method="CASH" en OrderCreateRequest) -- y el
        // backend los exige obligatorios, causando 422 "Field required".
        encodeDefaults = true
    }

    @Provides
    @Singleton
    fun provideOkHttpClient(authInterceptor: AuthInterceptor): OkHttpClient {
        val logging = HttpLoggingInterceptor().apply {
            level = if (BuildConfig.DEBUG) {
                HttpLoggingInterceptor.Level.BODY
            } else {
                HttpLoggingInterceptor.Level.NONE
            }
        }
        return OkHttpClient.Builder()
            .addInterceptor(authInterceptor)
            .addInterceptor(logging)
            .build()
    }

    @Provides
    @Singleton
    fun provideRetrofit(client: OkHttpClient, json: Json): Retrofit =
        Retrofit.Builder()
            .baseUrl(BuildConfig.BASE_URL)
            .client(client)
            .addConverterFactory(json.asConverterFactory("application/json".toMediaType()))
            .build()

    @Provides
    @Singleton
    fun provideAuthApi(retrofit: Retrofit): AuthApi = retrofit.create(AuthApi::class.java)

    @Provides
    @Singleton
    fun provideMesasApi(retrofit: Retrofit): MesasApi = retrofit.create(MesasApi::class.java)

    @Provides
    @Singleton
    fun provideDashboardApi(retrofit: Retrofit): DashboardApi = retrofit.create(DashboardApi::class.java)

    @Provides
    @Singleton
    fun provideLocalsApi(retrofit: Retrofit): LocalsApi = retrofit.create(LocalsApi::class.java)

    @Provides
    @Singleton
    fun provideCajasApi(retrofit: Retrofit): CajasApi = retrofit.create(CajasApi::class.java)

    @Provides
    @Singleton
    fun provideOrdersApi(retrofit: Retrofit): OrdersApi = retrofit.create(OrdersApi::class.java)

    @Provides
    @Singleton
    fun provideWebhooksApi(retrofit: Retrofit): WebhooksApi = retrofit.create(WebhooksApi::class.java)
}
